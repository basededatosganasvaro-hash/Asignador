"""
Sincronizacion de tablas resumen.
Consolida datos de 3 BDs (Sistema, Clientes, Capacidades) en tablas
resumen_oportunidades y resumen_usuarios de BD Sistema.
"""

import logging
import time
from datetime import datetime, date, timedelta

import psycopg2
import psycopg2.extras

from ..config import DB_URLS

logger = logging.getLogger(__name__)

BATCH_SIZE = 1000


def _connect(db_name: str):
    url = DB_URLS.get(db_name, "")
    if not url:
        raise ValueError(f"No URL configured for database: {db_name}")
    return psycopg2.connect(url)


def sync_resumen_oportunidades() -> dict:
    """Sincroniza resumen_oportunidades consolidando 3 BDs."""
    start = time.time()
    rows_processed = 0

    conn_sistema = _connect("sistema")
    conn_clientes = _connect("clientes")

    try:
        conn_sistema.autocommit = False
        cur_s = conn_sistema.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur_clientes = conn_clientes.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        # 1. Obtener oportunidades con joins en BD Sistema
        cur_s.execute("""
            SELECT
                o.id AS oportunidad_id,
                o.cliente_id,
                o.usuario_id,
                o.etapa_id,
                o.origen,
                o.lote_id,
                o.timer_vence,
                o.num_operacion,
                o.venta_validada,
                o.activo,
                o.created_at AS oportunidad_created,
                o.updated_at AS oportunidad_updated,
                ee.nombre AS etapa_nombre,
                ee.tipo AS etapa_tipo,
                ee.orden AS etapa_orden,
                ee.color AS etapa_color,
                u.nombre AS usuario_nombre,
                u.username AS usuario_username,
                u.rol AS usuario_rol,
                u.equipo_id,
                eq.nombre AS equipo_nombre,
                u.sucursal_id,
                suc.nombre AS sucursal_nombre,
                z.id AS zona_id,
                z.nombre AS zona_nombre,
                r.id AS region_id,
                r.nombre AS region_nombre
            FROM oportunidades o
            JOIN usuarios u ON u.id = o.usuario_id
            LEFT JOIN embudo_etapas ee ON ee.id = o.etapa_id
            LEFT JOIN equipos eq ON eq.id = u.equipo_id
            LEFT JOIN sucursales suc ON suc.id = u.sucursal_id
            LEFT JOIN zonas z ON z.id = suc.zona_id
            LEFT JOIN regiones r ON r.id = z.region_id
        """)
        oportunidades = cur_s.fetchall()
        logger.info(f"Fetched {len(oportunidades)} oportunidades from BD Sistema")

        # 2. Obtener historial agregado por oportunidad
        cur_s.execute("""
            SELECT
                oportunidad_id,
                COUNT(*) AS total_interacciones,
                COUNT(*) FILTER (WHERE tipo = 'LLAMADA') AS total_llamadas,
                COUNT(*) FILTER (WHERE tipo = 'WHATSAPP') AS total_whatsapp,
                COUNT(*) FILTER (WHERE tipo = 'SMS') AS total_sms,
                COUNT(*) FILTER (WHERE tipo = 'NOTA') AS total_notas,
                COUNT(*) FILTER (WHERE tipo = 'CAMBIO_ETAPA') AS total_cambios_etapa,
                MAX(created_at) AS ultima_interaccion
            FROM historial
            GROUP BY oportunidad_id
        """)
        historial_map = {row["oportunidad_id"]: row for row in cur_s.fetchall()}

        # 3. Obtener ventas
        cur_s.execute("""
            SELECT oportunidad_id, monto, created_at
            FROM ventas
        """)
        ventas_map = {row["oportunidad_id"]: row for row in cur_s.fetchall()}

        # 4. Obtener captaciones
        cur_s.execute("""
            SELECT oportunidad_id, origen_captacion, convenio, created_at
            FROM captaciones
        """)
        captaciones_map = {row["oportunidad_id"]: row for row in cur_s.fetchall()}

        # 5. Obtener datos_contacto (overrides)
        cur_s.execute("""
            SELECT DISTINCT ON (cliente_id, campo)
                cliente_id, campo, valor
            FROM datos_contacto
            ORDER BY cliente_id, campo, created_at DESC
        """)
        contacto_overrides = {}
        for row in cur_s.fetchall():
            cid = row["cliente_id"]
            if cid not in contacto_overrides:
                contacto_overrides[cid] = {}
            contacto_overrides[cid][row["campo"]] = row["valor"]

        # 6. Batch-fetch clientes desde BD Clientes
        cliente_ids = list({o["cliente_id"] for o in oportunidades if o["cliente_id"]})
        clientes_map = {}
        for i in range(0, len(cliente_ids), BATCH_SIZE):
            batch = cliente_ids[i:i + BATCH_SIZE]
            placeholders = ",".join(["%s"] * len(batch))
            cur_clientes.execute(f"""
                SELECT id, nss, nombres, a_paterno, a_materno, curp, rfc,
                       edad, genero, estado, municipio, cp, convenio,
                       tipo_cliente, tipo_pension, capacidad, oferta,
                       plazo_oferta, tasa, financiera, dependencia,
                       estatus, monto, monto_comisionable,
                       tel_1, direccion_email
                FROM clientes
                WHERE id IN ({placeholders})
            """, batch)
            for row in cur_clientes.fetchall():
                clientes_map[row["id"]] = row

        logger.info(f"Fetched {len(clientes_map)} clientes from BD Clientes")

        # 7. Merge y upsert
        now = datetime.utcnow()
        upsert_sql = """
            INSERT INTO resumen_oportunidades (
                oportunidad_id, cliente_id, usuario_id, etapa_id, origen, lote_id,
                timer_vence, num_operacion, venta_validada, activo,
                oportunidad_created, oportunidad_updated,
                etapa_nombre, etapa_tipo, etapa_orden, etapa_color,
                usuario_nombre, usuario_username, usuario_rol,
                equipo_id, equipo_nombre,
                sucursal_id, sucursal_nombre, zona_id, zona_nombre,
                region_id, region_nombre,
                cliente_nss, cliente_nombres, cliente_a_paterno, cliente_a_materno,
                cliente_curp, cliente_rfc, cliente_edad, cliente_genero,
                cliente_estado, cliente_municipio, cliente_cp, cliente_convenio,
                cliente_tipo_cliente, cliente_tipo_pension, cliente_capacidad,
                cliente_oferta, cliente_plazo_oferta, cliente_tasa,
                cliente_financiera, cliente_dependencia, cliente_estatus,
                cliente_monto, cliente_monto_comisionable,
                telefono_efectivo, email_efectivo,
                total_interacciones, total_llamadas, total_whatsapp,
                total_sms, total_notas, total_cambios_etapa, ultima_interaccion,
                venta_monto, venta_fecha,
                captacion_origen, captacion_convenio, captacion_fecha,
                timer_vencido, dias_sin_interaccion, sync_at
            ) VALUES (
                %(oportunidad_id)s, %(cliente_id)s, %(usuario_id)s, %(etapa_id)s,
                %(origen)s, %(lote_id)s, %(timer_vence)s, %(num_operacion)s,
                %(venta_validada)s, %(activo)s, %(oportunidad_created)s,
                %(oportunidad_updated)s,
                %(etapa_nombre)s, %(etapa_tipo)s, %(etapa_orden)s, %(etapa_color)s,
                %(usuario_nombre)s, %(usuario_username)s, %(usuario_rol)s,
                %(equipo_id)s, %(equipo_nombre)s,
                %(sucursal_id)s, %(sucursal_nombre)s, %(zona_id)s, %(zona_nombre)s,
                %(region_id)s, %(region_nombre)s,
                %(cliente_nss)s, %(cliente_nombres)s, %(cliente_a_paterno)s,
                %(cliente_a_materno)s, %(cliente_curp)s, %(cliente_rfc)s,
                %(cliente_edad)s, %(cliente_genero)s, %(cliente_estado)s,
                %(cliente_municipio)s, %(cliente_cp)s, %(cliente_convenio)s,
                %(cliente_tipo_cliente)s, %(cliente_tipo_pension)s,
                %(cliente_capacidad)s, %(cliente_oferta)s, %(cliente_plazo_oferta)s,
                %(cliente_tasa)s, %(cliente_financiera)s, %(cliente_dependencia)s,
                %(cliente_estatus)s, %(cliente_monto)s, %(cliente_monto_comisionable)s,
                %(telefono_efectivo)s, %(email_efectivo)s,
                %(total_interacciones)s, %(total_llamadas)s, %(total_whatsapp)s,
                %(total_sms)s, %(total_notas)s, %(total_cambios_etapa)s,
                %(ultima_interaccion)s,
                %(venta_monto)s, %(venta_fecha)s,
                %(captacion_origen)s, %(captacion_convenio)s, %(captacion_fecha)s,
                %(timer_vencido)s, %(dias_sin_interaccion)s, %(sync_at)s
            )
            ON CONFLICT (oportunidad_id) DO UPDATE SET
                cliente_id = EXCLUDED.cliente_id,
                usuario_id = EXCLUDED.usuario_id,
                etapa_id = EXCLUDED.etapa_id,
                origen = EXCLUDED.origen,
                lote_id = EXCLUDED.lote_id,
                timer_vence = EXCLUDED.timer_vence,
                num_operacion = EXCLUDED.num_operacion,
                venta_validada = EXCLUDED.venta_validada,
                activo = EXCLUDED.activo,
                oportunidad_created = EXCLUDED.oportunidad_created,
                oportunidad_updated = EXCLUDED.oportunidad_updated,
                etapa_nombre = EXCLUDED.etapa_nombre,
                etapa_tipo = EXCLUDED.etapa_tipo,
                etapa_orden = EXCLUDED.etapa_orden,
                etapa_color = EXCLUDED.etapa_color,
                usuario_nombre = EXCLUDED.usuario_nombre,
                usuario_username = EXCLUDED.usuario_username,
                usuario_rol = EXCLUDED.usuario_rol,
                equipo_id = EXCLUDED.equipo_id,
                equipo_nombre = EXCLUDED.equipo_nombre,
                sucursal_id = EXCLUDED.sucursal_id,
                sucursal_nombre = EXCLUDED.sucursal_nombre,
                zona_id = EXCLUDED.zona_id,
                zona_nombre = EXCLUDED.zona_nombre,
                region_id = EXCLUDED.region_id,
                region_nombre = EXCLUDED.region_nombre,
                cliente_nss = EXCLUDED.cliente_nss,
                cliente_nombres = EXCLUDED.cliente_nombres,
                cliente_a_paterno = EXCLUDED.cliente_a_paterno,
                cliente_a_materno = EXCLUDED.cliente_a_materno,
                cliente_curp = EXCLUDED.cliente_curp,
                cliente_rfc = EXCLUDED.cliente_rfc,
                cliente_edad = EXCLUDED.cliente_edad,
                cliente_genero = EXCLUDED.cliente_genero,
                cliente_estado = EXCLUDED.cliente_estado,
                cliente_municipio = EXCLUDED.cliente_municipio,
                cliente_cp = EXCLUDED.cliente_cp,
                cliente_convenio = EXCLUDED.cliente_convenio,
                cliente_tipo_cliente = EXCLUDED.cliente_tipo_cliente,
                cliente_tipo_pension = EXCLUDED.cliente_tipo_pension,
                cliente_capacidad = EXCLUDED.cliente_capacidad,
                cliente_oferta = EXCLUDED.cliente_oferta,
                cliente_plazo_oferta = EXCLUDED.cliente_plazo_oferta,
                cliente_tasa = EXCLUDED.cliente_tasa,
                cliente_financiera = EXCLUDED.cliente_financiera,
                cliente_dependencia = EXCLUDED.cliente_dependencia,
                cliente_estatus = EXCLUDED.cliente_estatus,
                cliente_monto = EXCLUDED.cliente_monto,
                cliente_monto_comisionable = EXCLUDED.cliente_monto_comisionable,
                telefono_efectivo = EXCLUDED.telefono_efectivo,
                email_efectivo = EXCLUDED.email_efectivo,
                total_interacciones = EXCLUDED.total_interacciones,
                total_llamadas = EXCLUDED.total_llamadas,
                total_whatsapp = EXCLUDED.total_whatsapp,
                total_sms = EXCLUDED.total_sms,
                total_notas = EXCLUDED.total_notas,
                total_cambios_etapa = EXCLUDED.total_cambios_etapa,
                ultima_interaccion = EXCLUDED.ultima_interaccion,
                venta_monto = EXCLUDED.venta_monto,
                venta_fecha = EXCLUDED.venta_fecha,
                captacion_origen = EXCLUDED.captacion_origen,
                captacion_convenio = EXCLUDED.captacion_convenio,
                captacion_fecha = EXCLUDED.captacion_fecha,
                timer_vencido = EXCLUDED.timer_vencido,
                dias_sin_interaccion = EXCLUDED.dias_sin_interaccion,
                sync_at = EXCLUDED.sync_at
        """

        cur_w = conn_sistema.cursor()

        for op in oportunidades:
            cid = op["cliente_id"]
            oid = op["oportunidad_id"]
            hist = historial_map.get(oid, {})
            venta = ventas_map.get(oid, {})
            capt = captaciones_map.get(oid, {})
            cliente = clientes_map.get(cid, {}) if cid else {}
            overrides = contacto_overrides.get(cid, {}) if cid else {}

            # Telefono efectivo: override > cliente original
            tel_efectivo = overrides.get("tel_1") or cliente.get("tel_1")
            email_efectivo = overrides.get("direccion_email") or cliente.get("direccion_email")

            # Timer vencido
            timer_vencido = False
            if op["timer_vence"] and op["activo"]:
                timer_vencido = op["timer_vence"] < now

            # Dias sin interaccion
            ultima = hist.get("ultima_interaccion")
            dias_sin = None
            if ultima:
                dias_sin = (now - ultima).days

            params = {
                "oportunidad_id": oid,
                "cliente_id": cid,
                "usuario_id": op["usuario_id"],
                "etapa_id": op["etapa_id"],
                "origen": op["origen"],
                "lote_id": op["lote_id"],
                "timer_vence": op["timer_vence"],
                "num_operacion": op["num_operacion"],
                "venta_validada": op["venta_validada"],
                "activo": op["activo"],
                "oportunidad_created": op["oportunidad_created"],
                "oportunidad_updated": op["oportunidad_updated"],
                "etapa_nombre": op["etapa_nombre"],
                "etapa_tipo": op["etapa_tipo"],
                "etapa_orden": op["etapa_orden"],
                "etapa_color": op["etapa_color"],
                "usuario_nombre": op["usuario_nombre"],
                "usuario_username": op["usuario_username"],
                "usuario_rol": op["usuario_rol"],
                "equipo_id": op["equipo_id"],
                "equipo_nombre": op["equipo_nombre"],
                "sucursal_id": op["sucursal_id"],
                "sucursal_nombre": op["sucursal_nombre"],
                "zona_id": op["zona_id"],
                "zona_nombre": op["zona_nombre"],
                "region_id": op["region_id"],
                "region_nombre": op["region_nombre"],
                "cliente_nss": cliente.get("nss"),
                "cliente_nombres": cliente.get("nombres"),
                "cliente_a_paterno": cliente.get("a_paterno"),
                "cliente_a_materno": cliente.get("a_materno"),
                "cliente_curp": cliente.get("curp"),
                "cliente_rfc": cliente.get("rfc"),
                "cliente_edad": cliente.get("edad"),
                "cliente_genero": cliente.get("genero"),
                "cliente_estado": cliente.get("estado"),
                "cliente_municipio": cliente.get("municipio"),
                "cliente_cp": cliente.get("cp"),
                "cliente_convenio": cliente.get("convenio"),
                "cliente_tipo_cliente": cliente.get("tipo_cliente"),
                "cliente_tipo_pension": cliente.get("tipo_pension"),
                "cliente_capacidad": cliente.get("capacidad"),
                "cliente_oferta": cliente.get("oferta"),
                "cliente_plazo_oferta": cliente.get("plazo_oferta"),
                "cliente_tasa": cliente.get("tasa"),
                "cliente_financiera": cliente.get("financiera"),
                "cliente_dependencia": cliente.get("dependencia"),
                "cliente_estatus": cliente.get("estatus"),
                "cliente_monto": cliente.get("monto"),
                "cliente_monto_comisionable": cliente.get("monto_comisionable"),
                "telefono_efectivo": tel_efectivo,
                "email_efectivo": email_efectivo,
                "total_interacciones": hist.get("total_interacciones", 0),
                "total_llamadas": hist.get("total_llamadas", 0),
                "total_whatsapp": hist.get("total_whatsapp", 0),
                "total_sms": hist.get("total_sms", 0),
                "total_notas": hist.get("total_notas", 0),
                "total_cambios_etapa": hist.get("total_cambios_etapa", 0),
                "ultima_interaccion": ultima,
                "venta_monto": venta.get("monto"),
                "venta_fecha": venta.get("created_at"),
                "captacion_origen": capt.get("origen_captacion"),
                "captacion_convenio": capt.get("convenio"),
                "captacion_fecha": capt.get("created_at"),
                "timer_vencido": timer_vencido,
                "dias_sin_interaccion": dias_sin,
                "sync_at": now,
            }

            cur_w.execute(upsert_sql, params)
            rows_processed += 1

        conn_sistema.commit()
        duration = time.time() - start
        logger.info(f"resumen_oportunidades: {rows_processed} rows in {duration:.1f}s")
        return {"table": "resumen_oportunidades", "rows": rows_processed, "duration_s": round(duration, 1)}

    except Exception:
        conn_sistema.rollback()
        raise
    finally:
        conn_sistema.close()
        conn_clientes.close()


def sync_resumen_usuarios() -> dict:
    """Sincroniza resumen_usuarios consolidando 3 BDs."""
    start = time.time()
    rows_processed = 0

    conn_sistema = _connect("sistema")
    conn_capacidades = _connect("capacidades")

    try:
        conn_sistema.autocommit = False
        cur_s = conn_sistema.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cur_cap = conn_capacidades.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

        now = datetime.utcnow()
        today = date.today()
        week_start = today - timedelta(days=today.weekday())
        month_start = today.replace(day=1)

        # 1. Usuarios con jerarquia
        cur_s.execute("""
            SELECT
                u.id AS usuario_id, u.nombre, u.username, u.rol,
                u.telegram_id, u.activo, u.created_at AS usuario_created,
                u.equipo_id, eq.nombre AS equipo_nombre,
                u.sucursal_id, suc.nombre AS sucursal_nombre,
                z.id AS zona_id, z.nombre AS zona_nombre,
                r.id AS region_id, r.nombre AS region_nombre
            FROM usuarios u
            LEFT JOIN equipos eq ON eq.id = u.equipo_id
            LEFT JOIN sucursales suc ON suc.id = u.sucursal_id
            LEFT JOIN zonas z ON z.id = suc.zona_id
            LEFT JOIN regiones r ON r.id = z.region_id
        """)
        usuarios = cur_s.fetchall()

        # 2. Oportunidades por usuario y etapa
        cur_s.execute("""
            SELECT
                usuario_id,
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE activo = true) AS activas,
                COUNT(*) FILTER (WHERE origen = 'POOL') AS pool,
                COUNT(*) FILTER (WHERE origen = 'CAPTACION') AS captacion,
                COUNT(*) FILTER (WHERE etapa_id = 1 AND activo) AS e1,
                COUNT(*) FILTER (WHERE etapa_id = 2 AND activo) AS e2,
                COUNT(*) FILTER (WHERE etapa_id = 3 AND activo) AS e3,
                COUNT(*) FILTER (WHERE etapa_id = 4 AND activo) AS e4,
                COUNT(*) FILTER (WHERE etapa_id = 5 AND activo) AS e5,
                COUNT(*) FILTER (WHERE etapa_id = 6 AND activo) AS e6,
                COUNT(*) FILTER (WHERE etapa_id = 7 AND activo) AS e7,
                COUNT(*) FILTER (WHERE etapa_id = 8 AND activo) AS e8
            FROM oportunidades
            GROUP BY usuario_id
        """)
        ops_map = {row["usuario_id"]: row for row in cur_s.fetchall()}

        # 3. Ventas por usuario
        cur_s.execute("""
            SELECT
                usuario_id,
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE validada = true) AS validadas,
                COALESCE(SUM(monto), 0) AS monto_total,
                COALESCE(SUM(monto) FILTER (WHERE validada = true), 0) AS monto_validado
            FROM ventas
            GROUP BY usuario_id
        """)
        ventas_map = {row["usuario_id"]: row for row in cur_s.fetchall()}

        # 4. Interacciones por periodo
        cur_s.execute("""
            SELECT
                usuario_id,
                COUNT(*) FILTER (WHERE created_at::date = %s) AS hoy,
                COUNT(*) FILTER (WHERE created_at::date >= %s) AS semana,
                COUNT(*) FILTER (WHERE created_at::date >= %s) AS mes,
                COUNT(*) FILTER (WHERE tipo = 'LLAMADA') AS llamadas,
                COUNT(*) FILTER (WHERE tipo = 'WHATSAPP') AS whatsapp
            FROM historial
            GROUP BY usuario_id
        """, (today, week_start, month_start))
        inter_map = {row["usuario_id"]: row for row in cur_s.fetchall()}

        # 5. Captaciones por usuario y origen
        cur_s.execute("""
            SELECT
                usuario_id,
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE origen_captacion = 'CAMBACEO') AS cambaceo,
                COUNT(*) FILTER (WHERE origen_captacion = 'REFERIDO') AS referido,
                COUNT(*) FILTER (WHERE origen_captacion = 'REDES_SOCIALES') AS redes
            FROM captaciones
            GROUP BY usuario_id
        """)
        capt_map = {row["usuario_id"]: row for row in cur_s.fetchall()}

        # 6. Cupo hoy
        cur_s.execute("""
            SELECT usuario_id, total_asignado, limite
            FROM cupo_diario
            WHERE fecha = %s
        """, (today,))
        cupo_map = {row["usuario_id"]: row for row in cur_s.fetchall()}

        # 7. Solicitudes IMSS desde BD Capacidades
        telegram_ids = [u["telegram_id"] for u in usuarios if u["telegram_id"]]
        solicitudes_map = {}
        if telegram_ids:
            for i in range(0, len(telegram_ids), BATCH_SIZE):
                batch = telegram_ids[i:i + BATCH_SIZE]
                placeholders = ",".join(["%s"] * len(batch))
                cur_cap.execute(f"""
                    SELECT
                        user_id,
                        COUNT(*) AS total,
                        COUNT(*) FILTER (WHERE estado = 'pendiente') AS pendientes,
                        COUNT(*) FILTER (WHERE estado != 'pendiente') AS resueltas
                    FROM solicitudes
                    WHERE user_id IN ({placeholders})
                    GROUP BY user_id
                """, batch)
                for row in cur_cap.fetchall():
                    solicitudes_map[row["user_id"]] = row

        # 8. Upsert
        upsert_sql = """
            INSERT INTO resumen_usuarios (
                usuario_id, nombre, username, rol, telegram_id, activo, usuario_created,
                equipo_id, equipo_nombre, sucursal_id, sucursal_nombre,
                zona_id, zona_nombre, region_id, region_nombre,
                oportunidades_total, oportunidades_activas,
                oportunidades_pool, oportunidades_captacion,
                oportunidades_etapa_1, oportunidades_etapa_2,
                oportunidades_etapa_3, oportunidades_etapa_4,
                oportunidades_etapa_5, oportunidades_etapa_6,
                oportunidades_etapa_7, oportunidades_etapa_8,
                ventas_total, ventas_validadas, ventas_monto_total, ventas_monto_validado,
                tasa_asignacion_contacto, tasa_contacto_venta, tasa_global,
                interacciones_hoy, interacciones_semana, interacciones_mes,
                llamadas_total, whatsapp_total,
                captaciones_total, captaciones_cambaceo, captaciones_referido, captaciones_redes,
                solicitudes_imss_total, solicitudes_imss_pendientes, solicitudes_imss_resueltas,
                cupo_hoy_asignado, cupo_hoy_limite, sync_at
            ) VALUES (
                %(usuario_id)s, %(nombre)s, %(username)s, %(rol)s, %(telegram_id)s,
                %(activo)s, %(usuario_created)s,
                %(equipo_id)s, %(equipo_nombre)s, %(sucursal_id)s, %(sucursal_nombre)s,
                %(zona_id)s, %(zona_nombre)s, %(region_id)s, %(region_nombre)s,
                %(oportunidades_total)s, %(oportunidades_activas)s,
                %(oportunidades_pool)s, %(oportunidades_captacion)s,
                %(oportunidades_etapa_1)s, %(oportunidades_etapa_2)s,
                %(oportunidades_etapa_3)s, %(oportunidades_etapa_4)s,
                %(oportunidades_etapa_5)s, %(oportunidades_etapa_6)s,
                %(oportunidades_etapa_7)s, %(oportunidades_etapa_8)s,
                %(ventas_total)s, %(ventas_validadas)s,
                %(ventas_monto_total)s, %(ventas_monto_validado)s,
                %(tasa_asignacion_contacto)s, %(tasa_contacto_venta)s, %(tasa_global)s,
                %(interacciones_hoy)s, %(interacciones_semana)s, %(interacciones_mes)s,
                %(llamadas_total)s, %(whatsapp_total)s,
                %(captaciones_total)s, %(captaciones_cambaceo)s,
                %(captaciones_referido)s, %(captaciones_redes)s,
                %(solicitudes_imss_total)s, %(solicitudes_imss_pendientes)s,
                %(solicitudes_imss_resueltas)s,
                %(cupo_hoy_asignado)s, %(cupo_hoy_limite)s, %(sync_at)s
            )
            ON CONFLICT (usuario_id) DO UPDATE SET
                nombre = EXCLUDED.nombre,
                username = EXCLUDED.username,
                rol = EXCLUDED.rol,
                telegram_id = EXCLUDED.telegram_id,
                activo = EXCLUDED.activo,
                usuario_created = EXCLUDED.usuario_created,
                equipo_id = EXCLUDED.equipo_id,
                equipo_nombre = EXCLUDED.equipo_nombre,
                sucursal_id = EXCLUDED.sucursal_id,
                sucursal_nombre = EXCLUDED.sucursal_nombre,
                zona_id = EXCLUDED.zona_id,
                zona_nombre = EXCLUDED.zona_nombre,
                region_id = EXCLUDED.region_id,
                region_nombre = EXCLUDED.region_nombre,
                oportunidades_total = EXCLUDED.oportunidades_total,
                oportunidades_activas = EXCLUDED.oportunidades_activas,
                oportunidades_pool = EXCLUDED.oportunidades_pool,
                oportunidades_captacion = EXCLUDED.oportunidades_captacion,
                oportunidades_etapa_1 = EXCLUDED.oportunidades_etapa_1,
                oportunidades_etapa_2 = EXCLUDED.oportunidades_etapa_2,
                oportunidades_etapa_3 = EXCLUDED.oportunidades_etapa_3,
                oportunidades_etapa_4 = EXCLUDED.oportunidades_etapa_4,
                oportunidades_etapa_5 = EXCLUDED.oportunidades_etapa_5,
                oportunidades_etapa_6 = EXCLUDED.oportunidades_etapa_6,
                oportunidades_etapa_7 = EXCLUDED.oportunidades_etapa_7,
                oportunidades_etapa_8 = EXCLUDED.oportunidades_etapa_8,
                ventas_total = EXCLUDED.ventas_total,
                ventas_validadas = EXCLUDED.ventas_validadas,
                ventas_monto_total = EXCLUDED.ventas_monto_total,
                ventas_monto_validado = EXCLUDED.ventas_monto_validado,
                tasa_asignacion_contacto = EXCLUDED.tasa_asignacion_contacto,
                tasa_contacto_venta = EXCLUDED.tasa_contacto_venta,
                tasa_global = EXCLUDED.tasa_global,
                interacciones_hoy = EXCLUDED.interacciones_hoy,
                interacciones_semana = EXCLUDED.interacciones_semana,
                interacciones_mes = EXCLUDED.interacciones_mes,
                llamadas_total = EXCLUDED.llamadas_total,
                whatsapp_total = EXCLUDED.whatsapp_total,
                captaciones_total = EXCLUDED.captaciones_total,
                captaciones_cambaceo = EXCLUDED.captaciones_cambaceo,
                captaciones_referido = EXCLUDED.captaciones_referido,
                captaciones_redes = EXCLUDED.captaciones_redes,
                solicitudes_imss_total = EXCLUDED.solicitudes_imss_total,
                solicitudes_imss_pendientes = EXCLUDED.solicitudes_imss_pendientes,
                solicitudes_imss_resueltas = EXCLUDED.solicitudes_imss_resueltas,
                cupo_hoy_asignado = EXCLUDED.cupo_hoy_asignado,
                cupo_hoy_limite = EXCLUDED.cupo_hoy_limite,
                sync_at = EXCLUDED.sync_at
        """

        cur_w = conn_sistema.cursor()

        for u in usuarios:
            uid = u["usuario_id"]
            ops = ops_map.get(uid, {})
            vta = ventas_map.get(uid, {})
            inter = inter_map.get(uid, {})
            capt = capt_map.get(uid, {})
            cupo = cupo_map.get(uid, {})
            tid = u["telegram_id"]
            sol = solicitudes_map.get(tid, {}) if tid else {}

            # Tasas de conversion
            total_ops = ops.get("total", 0) or 0
            activas = ops.get("activas", 0) or 0
            total_ventas = vta.get("total", 0) or 0
            tasa_global = round((total_ventas / total_ops * 100), 2) if total_ops > 0 else 0

            params = {
                "usuario_id": uid,
                "nombre": u["nombre"],
                "username": u["username"],
                "rol": u["rol"],
                "telegram_id": tid,
                "activo": u["activo"],
                "usuario_created": u["usuario_created"],
                "equipo_id": u["equipo_id"],
                "equipo_nombre": u["equipo_nombre"],
                "sucursal_id": u["sucursal_id"],
                "sucursal_nombre": u["sucursal_nombre"],
                "zona_id": u["zona_id"],
                "zona_nombre": u["zona_nombre"],
                "region_id": u["region_id"],
                "region_nombre": u["region_nombre"],
                "oportunidades_total": ops.get("total", 0),
                "oportunidades_activas": ops.get("activas", 0),
                "oportunidades_pool": ops.get("pool", 0),
                "oportunidades_captacion": ops.get("captacion", 0),
                "oportunidades_etapa_1": ops.get("e1", 0),
                "oportunidades_etapa_2": ops.get("e2", 0),
                "oportunidades_etapa_3": ops.get("e3", 0),
                "oportunidades_etapa_4": ops.get("e4", 0),
                "oportunidades_etapa_5": ops.get("e5", 0),
                "oportunidades_etapa_6": ops.get("e6", 0),
                "oportunidades_etapa_7": ops.get("e7", 0),
                "oportunidades_etapa_8": ops.get("e8", 0),
                "ventas_total": vta.get("total", 0),
                "ventas_validadas": vta.get("validadas", 0),
                "ventas_monto_total": vta.get("monto_total", 0),
                "ventas_monto_validado": vta.get("monto_validado", 0),
                "tasa_asignacion_contacto": 0,  # Se calcula cuando haya etapas definidas
                "tasa_contacto_venta": 0,
                "tasa_global": tasa_global,
                "interacciones_hoy": inter.get("hoy", 0),
                "interacciones_semana": inter.get("semana", 0),
                "interacciones_mes": inter.get("mes", 0),
                "llamadas_total": inter.get("llamadas", 0),
                "whatsapp_total": inter.get("whatsapp", 0),
                "captaciones_total": capt.get("total", 0),
                "captaciones_cambaceo": capt.get("cambaceo", 0),
                "captaciones_referido": capt.get("referido", 0),
                "captaciones_redes": capt.get("redes", 0),
                "solicitudes_imss_total": sol.get("total", 0),
                "solicitudes_imss_pendientes": sol.get("pendientes", 0),
                "solicitudes_imss_resueltas": sol.get("resueltas", 0),
                "cupo_hoy_asignado": cupo.get("total_asignado", 0),
                "cupo_hoy_limite": cupo.get("limite", 300),
                "sync_at": now,
            }

            cur_w.execute(upsert_sql, params)
            rows_processed += 1

        conn_sistema.commit()
        duration = time.time() - start
        logger.info(f"resumen_usuarios: {rows_processed} rows in {duration:.1f}s")
        return {"table": "resumen_usuarios", "rows": rows_processed, "duration_s": round(duration, 1)}

    except Exception:
        conn_sistema.rollback()
        raise
    finally:
        conn_sistema.close()
        conn_capacidades.close()


async def sync_all() -> dict:
    """Ejecuta sincronizacion completa de ambas tablas resumen."""
    start = time.time()
    results = []

    result_ops = sync_resumen_oportunidades()
    results.append(result_ops)

    result_usr = sync_resumen_usuarios()
    results.append(result_usr)

    total_duration = time.time() - start
    return {
        "status": "ok",
        "tables": results,
        "total_duration_s": round(total_duration, 1),
    }
