# Avances Sesion 2026-02-20

## Problema: Loop infinito en /cambiar-password

### Contexto

Despues de que un admin reseteaba la password de un usuario (marcando `debe_cambiar_password = true`), el usuario al hacer login era redirigido correctamente a `/cambiar-password`. Sin embargo, al cambiar exitosamente su password, la pagina entraba en un **loop infinito**: el middleware seguia detectando `debe_cambiar_password = true` en el JWT y redirigia de vuelta a `/cambiar-password` una y otra vez.

### Causa raiz

El flujo tenia **3 problemas encadenados**:

1. **El JWT no se refrescaba despues del cambio de password.** La pagina `/cambiar-password` llamaba al API para actualizar la password en BD (poniendo `debe_cambiar_password = false`), pero el JWT del cliente seguia teniendo `debe_cambiar_password: true` porque nunca se le pedia a NextAuth que regenerara el token.

2. **El callback `jwt` de NextAuth no refrescaba `debe_cambiar_password` desde la BD.** Solo se asignaba `token.debe_cambiar_password` en el login inicial (`if (user)`), pero en requests subsecuentes el token conservaba el valor viejo sin consultar la BD.

3. **Usuarios nuevos no se creaban con `debe_cambiar_password: true`.** El endpoint POST de `/api/admin/usuarios` no incluia este campo, asi que usuarios recien creados podian saltarse el cambio obligatorio.

### Solucion implementada (3 commits)

#### Commit `2a800b4` — Refrescar JWT + forzar cambio en usuarios nuevos

- **`src/lib/auth.ts`**: En el callback `jwt`, se agrego un bloque `else if (token.id)` que consulta `debe_cambiar_password` desde la BD en cada request, manteniendo el JWT sincronizado.
- **`src/app/api/admin/usuarios/route.ts`**: Se agrego `debe_cambiar_password: true` al crear usuarios nuevos.
- **`src/app/api/admin/usuarios/[id]/route.ts`**: Al resetear password, se agrego log diagnostico del hash generado y se marca `debe_cambiar_password: true`.

#### Commit `d51a253` — Logs diagnosticos + proteger build

- **`src/lib/auth.ts`**: Se agregaron `console.log` en el flujo de login para diagnosticar problemas de autenticacion (intentos, hashes, resultado de bcrypt.compare).
- **`src/app/api/admin/usuarios/[id]/route.ts`**: Se incluye `password_hash` en el select del UPDATE para verificar que se guardo correctamente (sin exponerlo en la respuesta JSON).
- **`package.json`**: Se removio `--accept-data-loss` del comando build para proteger contra perdida de datos accidental en deploys. Tambien se removio `import-users-capacidades.ts` del build.

#### Commit `2dbb9d0` — Fix definitivo del loop infinito

- **`src/app/cambiar-password/page.tsx`**: Se extrajo `update` de `useSession()` y se llama `await update()` despues de cambiar la password exitosamente. Esto fuerza a NextAuth a regenerar el JWT del lado del cliente, que ahora (gracias al commit anterior) consulta la BD y obtiene `debe_cambiar_password: false`. El middleware ya no redirige y el usuario puede navegar normalmente.

### Flujo corregido

```
Admin resetea password
  → BD: debe_cambiar_password = true
  → Usuario hace login
  → JWT: debe_cambiar_password = true
  → Middleware redirige a /cambiar-password
  → Usuario cambia su password
  → API: BD actualiza hash + debe_cambiar_password = false
  → Frontend: await update() → NextAuth regenera JWT
  → JWT callback consulta BD → debe_cambiar_password = false
  → Middleware permite navegacion normal
```
