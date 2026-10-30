import { useState } from 'react';
import { Alert, View } from 'react-native';
import { IconButton, ListRow, Row, TextField } from '@/components/ui';
import { colors, spacing, type IconName } from '@/constants/theme';
import { friendlyError } from '@/services/supabase/client';

/** A list row with inline rename and delete (with confirmation). */
export function EditableRow({
  icon,
  title,
  subtitle,
  onPress,
  onRename,
  onDelete,
  deleteLabel,
  testID,
}: {
  icon: IconName;
  title: string;
  subtitle?: string | null;
  onPress?: () => void;
  onRename: (name: string) => Promise<void>;
  onDelete: () => Promise<void>;
  deleteLabel: string;
  testID?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(title);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setBusy(true);
    try {
      await onRename(value);
      setEditing(false);
      setError(null);
    } catch (e) {
      const issues = (e as { issues?: { message: string }[] }).issues;
      setError(issues?.[0]?.message ?? friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = () =>
    Alert.alert(`Delete ${deleteLabel}?`, `“${title}” will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => onDelete().catch((e) => Alert.alert('Could not delete', friendlyError(e))),
      },
    ]);

  if (editing) {
    return (
      <View style={{ paddingVertical: spacing.sm, gap: spacing.xs }}>
        <TextField label="New name" value={value} onChangeText={setValue} autoFocus maxLength={80} error={error} onSubmitEditing={save} returnKeyType="done" />
        <Row style={{ justifyContent: 'flex-end' }}>
          <IconButton icon="close" label="Cancel rename" color={colors.textMuted} onPress={() => { setEditing(false); setValue(title); setError(null); }} />
          <IconButton icon="checkmark" label="Save name" onPress={save} disabled={busy} />
        </Row>
      </View>
    );
  }
  return (
    <ListRow
      testID={testID}
      icon={icon}
      title={title}
      subtitle={subtitle}
      onPress={onPress}
      right={
        <Row gap={0}>
          <IconButton icon="create-outline" label={`Rename ${title}`} color={colors.textMuted} onPress={() => setEditing(true)} />
          <IconButton icon="trash-outline" label={`Delete ${title}`} color={colors.danger} onPress={confirmDelete} />
        </Row>
      }
    />
  );
}
