'use client';

import * as React from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Chip,
  Divider,
  Stack,
  Typography,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import type { Task } from '@/lib/types';

function dateSummary(tasks: Task[]) {
  const done = tasks.filter((t) => t.status === 'done').length;
  const total = tasks.length;
  const minutes = tasks.reduce((s, t) => s + t.planned_minutes, 0);
  return { done, total, minutes };
}

export default function PlanList({ tasksByDate }: { tasksByDate: Record<string, Task[]> }) {
  const dates = Object.keys(tasksByDate).sort();

  return (
    <Stack spacing={1}>
      {dates.map((date) => {
        const tasks = tasksByDate[date] ?? [];
        const s = dateSummary(tasks);
        return (
          <Accordion key={date} defaultExpanded={false}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                <Typography fontWeight={700}>{date}</Typography>
                <Chip size="small" label={`${s.done}/${s.total}`} />
                <Chip size="small" variant="outlined" label={`${s.minutes}分`} />
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={1}>
                {tasks.map((t) => (
                  <Box key={t.id}>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography
                        variant="body2"
                        sx={{ textDecoration: t.status === 'done' ? 'line-through' : 'none' }}
                      >
                        {t.title}
                      </Typography>
                      <Chip size="small" variant="outlined" label={`${t.planned_minutes}分`} />
                      {t.status === 'done' && <Chip size="small" color="success" label="完了" />}
                      {t.status === 'skipped' && <Chip size="small" color="warning" label="スキップ" />}
                    </Stack>
                    {t.meta?.problem_page_start && (
                      <Typography variant="caption" color="text.secondary">
                        問題集 p{t.meta.problem_page_start}〜
                      </Typography>
                    )}
                    <Divider sx={{ my: 1 }} />
                  </Box>
                ))}
              </Stack>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Stack>
  );
}
