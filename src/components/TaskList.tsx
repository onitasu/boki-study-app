'use client';

import * as React from 'react';
import {
  Box,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Typography,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Button,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import { createClient } from '@/lib/supabase/client';
import type { Task, TaskStatus, TaskType } from '@/lib/types';

function subjectLabel(subject: Task['subject']): string {
  if (subject === 'commercial') return '商業';
  if (subject === 'industrial') return '工業';
  return '総合';
}

function typeLabel(type: TaskType): string {
  switch (type) {
    case 'learn':
      return 'テキスト';
    case 'drill':
      return '問題集';
    case 'review':
      return '復習';
    case 'mock':
      return '模試';
    case 'weekly_review':
      return '週次';
    default:
      return type;
  }
}

export default function TaskList({ initialTasks, dateLabel }: { initialTasks: Task[]; dateLabel: string }) {
  const supabase = React.useMemo(() => createClient(), []);
  const [tasks, setTasks] = React.useState<Task[]>(initialTasks);

  const [editing, setEditing] = React.useState<Task | null>(null);
  const [actualMinutes, setActualMinutes] = React.useState<string>('');
  const [note, setNote] = React.useState<string>('');

  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const plannedTotal = tasks.reduce((s, t) => s + t.planned_minutes, 0);

  async function updateStatus(taskId: string, status: TaskStatus) {
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    const { error } = await supabase.from('tasks').update({ status }).eq('id', taskId);
    if (error) {
      // rollback (simple)
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: status === 'done' ? 'todo' : 'done' } : t)));
      alert(`更新に失敗しました: ${error.message}`);
    }
  }

  async function saveEdit() {
    if (!editing) return;
    const taskId = editing.id;
    const actual = actualMinutes.trim() === '' ? null : Number(actualMinutes);
    const newNote = note.trim() === '' ? null : note.trim();

    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, actual_minutes: actual, note: newNote } : t))
    );

    const { error } = await supabase
      .from('tasks')
      .update({ actual_minutes: actual, note: newNote })
      .eq('id', taskId);

    if (error) {
      alert(`更新に失敗しました: ${error.message}`);
    }

    setEditing(null);
  }

  function openEdit(task: Task) {
    setEditing(task);
    setActualMinutes(task.actual_minutes?.toString() ?? '');
    setNote(task.note ?? '');
  }

  const grouped = React.useMemo(() => {
    const bySubject: Record<string, Task[]> = {};
    for (const t of tasks) {
      const key = t.subject;
      bySubject[key] = bySubject[key] ?? [];
      bySubject[key].push(t);
    }
    const order: Task['subject'][] = ['mixed', 'commercial', 'industrial'];
    return order
      .filter((s) => (bySubject[s] ?? []).length > 0)
      .map((s) => ({ subject: s as Task['subject'], tasks: bySubject[s] }));
  }, [tasks]);

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Stack spacing={0.5}>
            <Typography variant="h6" fontWeight={700}>
              {dateLabel} のタスク
            </Typography>
            <Typography variant="body2" color="text.secondary">
              完了 {doneCount}/{tasks.length} ・ 予定合計 {plannedTotal}分
            </Typography>
          </Stack>
        </CardContent>
      </Card>

      {grouped.map((g) => (
        <Card key={g.subject}>
          <CardContent>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography fontWeight={700}>{subjectLabel(g.subject)}</Typography>
                <Chip size="small" label={`${g.tasks.length}件`} />
              </Stack>
              <Divider />
              <List disablePadding>
                {g.tasks
                  .slice()
                  .sort((a, b) => {
                    // show undone first
                    if (a.status === b.status) return a.title.localeCompare(b.title);
                    if (a.status === 'done') return 1;
                    if (b.status === 'done') return -1;
                    return 0;
                  })
                  .map((t) => (
                    <ListItem key={t.id} divider>
                      <ListItemIcon>
                        <Checkbox
                          edge="start"
                          checked={t.status === 'done'}
                          onChange={() => updateStatus(t.id, t.status === 'done' ? 'todo' : 'done')}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Typography
                              variant="body1"
                              sx={{ textDecoration: t.status === 'done' ? 'line-through' : 'none' }}
                            >
                              {t.title}
                            </Typography>
                            <Chip size="small" label={typeLabel(t.task_type)} />
                            <Chip size="small" variant="outlined" label={`${t.planned_minutes}分`} />
                          </Stack>
                        }
                        secondary={
                          t.meta?.problem_page_start
                            ? `問題集 p${t.meta.problem_page_start}〜`
                            : t.note
                              ? `メモ: ${t.note}`
                              : undefined
                        }
                      />
                      <IconButton edge="end" aria-label="edit" onClick={() => openEdit(t)}>
                        <EditIcon />
                      </IconButton>
                    </ListItem>
                  ))}
              </List>
            </Stack>
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!editing} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
        <DialogTitle>タスク記録</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {editing?.title}
            </Typography>
            <TextField
              label="実績時間（分）"
              type="number"
              value={actualMinutes}
              onChange={(e) => setActualMinutes(e.target.value)}
              inputProps={{ min: 0, step: 5 }}
              helperText="未入力でもOK"
            />
            <TextField
              label="メモ"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              multiline
              minRows={3}
              placeholder="詰まった点 / 間違いポイント / 明日の自分へ"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>キャンセル</Button>
          <Button onClick={saveEdit} variant="contained">
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
