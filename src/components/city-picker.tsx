import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { searchCities, type ColombianCity } from '@/domain/cities';
import { space, useColors, type Palette } from '@/theme/colors';

type CityPickerProps = {
  label?: string;
  value: string;
  error?: string;
  onChange: (city: string) => void;
};

export function CityPicker({ label = 'Ciudad', value, error, onChange }: CityPickerProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchCities(query), [query]);

  function choose(city: ColombianCity) {
    onChange(city.name);
    setOpen(false);
    setQuery('');
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={value ? `${label}, ${value}` : 'Elegir ciudad'}
        onPress={() => setOpen(true)}
        style={[styles.input, error ? styles.inputError : null]}>
        <Text style={value ? styles.value : styles.placeholder}>{value || 'Elige tu ciudad'}</Text>
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modal} edges={['top', 'left', 'right']}>
          <View style={styles.modalTop}>
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.close}>
              <Text style={styles.closeLabel}>Cerrar</Text>
            </Pressable>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Buscar ciudad"
              placeholderTextColor={colors.placeholder}
              autoCapitalize="words"
              autoCorrect={false}
              style={styles.search}
            />
          </View>
          <FlatList
            data={results}
            keyExtractor={(city) => `${city.name}-${city.department}`}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={styles.empty}>{query.trim() ? 'Ninguna ciudad con ese nombre.' : 'Escribe el nombre de tu ciudad.'}</Text>}
            renderItem={({ item }) => {
              const selected = item.name === value;
              return (
                <Pressable accessibilityRole="button" onPress={() => choose(item)} style={[styles.row, selected ? styles.rowOn : null]}>
                  <Text style={styles.rowName}>{item.name}</Text>
                  <Text style={styles.rowDepartment}>{item.department}</Text>
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function createStyles(colors: Palette) {
  return StyleSheet.create({
    wrap: {
      gap: 6,
    },
    label: {
      color: colors.ink,
      fontSize: 14,
      fontWeight: '500',
    },
    input: {
      minHeight: 52,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.card,
      paddingHorizontal: space.md,
      justifyContent: 'center',
    },
    inputError: {
      borderColor: colors.danger,
    },
    value: {
      color: colors.ink,
      fontSize: 16,
    },
    placeholder: {
      color: colors.placeholder,
      fontSize: 16,
    },
    error: {
      color: colors.danger,
      fontSize: 13,
    },
    modal: {
      flex: 1,
      backgroundColor: colors.paper,
    },
    modalTop: {
      paddingHorizontal: space.md,
      paddingBottom: 8,
      gap: 10,
    },
    close: {
      alignSelf: 'flex-start',
      minHeight: 40,
      justifyContent: 'center',
    },
    closeLabel: {
      color: colors.action,
      fontSize: 16,
      fontWeight: '600',
    },
    search: {
      height: 48,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.card,
      paddingHorizontal: space.md,
      color: colors.ink,
      fontSize: 16,
    },
    list: {
      paddingHorizontal: space.md,
      paddingBottom: 24,
      gap: 8,
    },
    empty: {
      color: colors.muted,
      fontSize: 15,
      paddingTop: 12,
    },
    row: {
      borderRadius: 16,
      backgroundColor: colors.card,
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 2,
    },
    rowOn: {
      backgroundColor: colors.actionSoft,
    },
    rowName: {
      color: colors.ink,
      fontSize: 16,
      fontWeight: '600',
    },
    rowDepartment: {
      color: colors.muted,
      fontSize: 13,
    },
  });
}
