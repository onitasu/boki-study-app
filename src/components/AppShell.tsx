'use client';

import * as React from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  AppBar,
  Box,
  BottomNavigation,
  BottomNavigationAction,
  Container,
  IconButton,
  Toolbar,
  Typography,
} from '@mui/material';
import TodayIcon from '@mui/icons-material/Today';
import ViewListIcon from '@mui/icons-material/ViewList';
import ChecklistIcon from '@mui/icons-material/Checklist';
import SettingsIcon from '@mui/icons-material/Settings';
import StyleIcon from '@mui/icons-material/Style';
import EditNoteIcon from '@mui/icons-material/EditNote';
import LogoutIcon from '@mui/icons-material/Logout';
import { signOut } from '@/app/login/actions';

const NAV_ITEMS = [
  { label: '今日', href: '/today', icon: <TodayIcon /> },
  { label: '計画', href: '/plan', icon: <ViewListIcon /> },
  { label: 'テーマ', href: '/themes', icon: <ChecklistIcon /> },
  { label: 'カード', href: '/flashcards', icon: <StyleIcon /> },
  { label: '設定', href: '/settings', icon: <SettingsIcon /> },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const isAuthPage = pathname?.startsWith('/login');

  const currentIndex = React.useMemo(() => {
    const idx = NAV_ITEMS.findIndex((n) => pathname?.startsWith(n.href));
    return idx === -1 ? 0 : idx;
  }, [pathname]);

  if (isAuthPage) {
    return (
      <Container sx={{ py: 4 }} maxWidth="md">
        {children}
      </Container>
    );
  }

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column' }}>
      <AppBar position="sticky" elevation={1}>
        <Toolbar>
          <EditNoteIcon sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            簿記2級 学習チェック
          </Typography>
          <Box component="form" action={signOut}>
            <IconButton color="inherit" aria-label="sign out" type="submit">
              <LogoutIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      <Container sx={{ flexGrow: 1, py: 2, pb: 9 }} maxWidth="md">
        {children}
      </Container>

      <Box
        sx={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          borderTop: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <BottomNavigation
          showLabels
          value={currentIndex}
          onChange={(_, newValue) => {
            const item = NAV_ITEMS[newValue];
            if (item) router.push(item.href);
          }}
        >
          {NAV_ITEMS.map((item) => (
            <BottomNavigationAction key={item.href} label={item.label} icon={item.icon} />
          ))}
        </BottomNavigation>
      </Box>
    </Box>
  );
}
