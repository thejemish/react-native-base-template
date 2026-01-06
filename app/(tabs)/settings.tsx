import { View, Text } from 'react-native';
import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native-unistyles';
import { Container } from '@/components/Container';

export default function SettingsScreen() {
  return (
    <Container>
      <Stack.Screen options={{ headerShown: true }} />
      <View style={styles.content}>
        <Text style={styles.heading}>Settings</Text>
        <Text style={styles.subtitle}>Manage your app preferences</Text>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create((theme) => ({
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: theme.margins.md * 2,
  },
  heading: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.typography,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.typography,
    opacity: 0.7,
  },
}));
