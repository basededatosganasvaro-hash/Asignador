import { Box, CircularProgress } from "@mui/material";

export default function OperacionesLoading() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", mt: 8 }}>
      <CircularProgress />
    </Box>
  );
}
