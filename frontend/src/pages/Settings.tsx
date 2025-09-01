import React from 'react';
import { Typography, Box, Alert } from '@mui/material';

const Settings: React.FC = () => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>
      <Alert severity="info">
        Settings page - this will contain configuration options for the application.
      </Alert>
    </Box>
  );
};

export default Settings;
