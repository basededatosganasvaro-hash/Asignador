"use client";
import { useState } from "react";
import { Box, Toolbar } from "@mui/material";
import Sidebar, { DRAWER_WIDTH, DRAWER_COLLAPSED } from "./Sidebar";
import Header from "./Header";

export default function LayoutShell({ rol, children }: { rol: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const toggle = () => setOpen((p) => !p);

  const sidebarWidth = open ? DRAWER_WIDTH : DRAWER_COLLAPSED;

  return (
    <Box sx={{ display: "flex" }}>
      <Sidebar rol={rol} open={open} onToggle={toggle} />
      <Header open={open} onToggle={toggle} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          ml: `${sidebarWidth}px`,
          width: `calc(100% - ${sidebarWidth}px)`,
          transition: "margin-left 0.25s ease, width 0.25s ease",
          bgcolor: "background.default",
          minHeight: "100vh",
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}
