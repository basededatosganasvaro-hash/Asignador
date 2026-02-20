"use client";
import { useState } from "react";
import { Box, Toolbar } from "@mui/material";
import Sidebar, { DRAWER_COLLAPSED } from "./Sidebar";
import Header from "./Header";

export default function LayoutShell({ rol, children }: { rol: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((p) => !p);

  return (
    <Box sx={{ display: "flex" }}>
      <Sidebar rol={rol} open={open} onToggle={toggle} />
      <Header onToggle={toggle} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 2,
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
