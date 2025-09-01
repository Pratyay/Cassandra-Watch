import React from 'react';
import { Box, Typography } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';

interface LogoProps {
  variant?: 'default' | 'compact';
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
}

const Logo: React.FC<LogoProps> = ({ 
  variant = 'default', 
  size = 'medium', 
  showText = true 
}) => {
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return { fontSize: '1rem', iconSize: 20 };
      case 'large':
        return { fontSize: '2rem', iconSize: 32 };
      default:
        return { fontSize: '1.5rem', iconSize: 24 };
    }
  };

  const { fontSize, iconSize } = getSizeStyles();

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <SearchIcon 
        sx={{ 
          fontSize: iconSize,
          color: 'primary.main',
          filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))'
        }} 
      />
      {showText && (
        <Typography 
          variant={variant === 'compact' ? 'h6' : 'h5'} 
          sx={{ 
            fontSize,
            fontWeight: 600,
            background: 'linear-gradient(45deg, #90caf9, #42a5f5)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            textShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          Cassandra Watch
        </Typography>
      )}
    </Box>
  );
};

export default Logo; 