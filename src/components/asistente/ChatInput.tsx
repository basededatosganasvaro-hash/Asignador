"use client";
import { useState, useRef } from "react";
import { Box, TextField, IconButton } from "@mui/material";
import SendIcon from "@mui/icons-material/Send";

interface ChatInputProps {
  onSend: (mensaje: string) => void;
  disabled: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = () => {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-end", p: 2, borderTop: 1, borderColor: "divider" }}>
      <TextField
        inputRef={inputRef}
        fullWidth
        multiline
        maxRows={4}
        placeholder="Escribe tu pregunta..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        size="small"
        sx={{ "& .MuiOutlinedInput-root": { borderRadius: 2 } }}
      />
      <IconButton
        color="primary"
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        sx={{ bgcolor: "primary.main", color: "white", "&:hover": { bgcolor: "primary.dark" }, "&.Mui-disabled": { bgcolor: "grey.300" } }}
      >
        <SendIcon />
      </IconButton>
    </Box>
  );
}
