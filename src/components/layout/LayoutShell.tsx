"use client";
import { useState } from "react";
import { Box, Toolbar } from "@mui/material";
import Sidebar, { DRAWER_WIDTH } from "./Sidebar";
import Header from "./Header";

export default function LayoutShell({ rol, children }: { rol: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  const toggle = () => setOpen((p) => !p);

  return (
    <Box sx={{ display: "flex" }}>
      <Sidebar rol={rol} open={open} onToggle={toggle} />
      <Header open={open} onToggle={toggle} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          ml: open ? `${DRAWER_WIDTH}px` : 0,
          width: open ? `calc(100% - ${DRAWER_WIDTH}px)` : "100%",
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
