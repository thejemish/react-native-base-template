import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Stack, useRouter } from 'expo-router';

import { Container } from '@/components/Container';

const onboardingSteps = [
  {
    title: 'Welcome',
    description: 'Discover amazing features and get started with our app today.',
  },
  {
    title: 'Explore',
    description: 'Navigate through our intuitive interface and find what you need.',
  },
  {
    title: 'Get Started',
    description: 'You\'re all set! Start your journey and make the most of our app.',
  },
];

export default function Index() {
  const [currentStep, setCurrentStep] = useState(0);
  const router = useRouter();

  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleSkip();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    // Navigate to the main app (tabs)
    router.replace('/(tabs)');
  };

  return (
    <Container>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        {/* Skip Button */}
        <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
          <Text style={styles.skipButtonText}>Skip</Text>
        </TouchableOpacity>

        {/* Content */}
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Step Indicator */}
            <View style={styles.stepIndicator}>
              {onboardingSteps.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    index === currentStep && styles.activeDot,
                  ]}
                />
              ))}
            </View>

            {/* Step Content */}
            <View style={styles.stepContent}>
              <Text style={styles.title}>
                {onboardingSteps[currentStep].title}
              </Text>
              <Text style={styles.description}>
                {onboardingSteps[currentStep].description}
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Navigation Buttons */}
        <View style={styles.navigation}>
          {currentStep > 0 && (
            <TouchableOpacity
              style={styles.previousButton}
              onPress={handlePrevious}
            >
              <Text style={styles.previousButtonText}>Previous</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
            <Text style={styles.nextButtonText}>
              {currentStep === onboardingSteps.length - 1
                ? 'Get Started'
                : 'Next'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Container>
  );
}

const styles = StyleSheet.create((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  skipButton: {
    alignSelf: 'flex-end',
    padding: theme.margins.md * 4,
    paddingTop: theme.margins.md * 6,
    zIndex: 1,
  },
  skipButtonText: {
    fontSize: 16,
    color: theme.colors.azureRadiance,
    fontWeight: '600',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.margins.xl * 2,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.margins.xl * 4,
    gap: theme.margins.md * 2,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.limedSpruce,
    opacity: 0.3,
  },
  activeDot: {
    width: 24,
    backgroundColor: theme.colors.azureRadiance,
    opacity: 1,
  },
  stepContent: {
    alignItems: 'center',
    gap: theme.margins.xl * 2,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: theme.colors.typography,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    color: theme.colors.typography,
    textAlign: 'center',
    opacity: 0.7,
    lineHeight: 24,
  },
  navigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.margins.xl * 2,
    paddingBottom: theme.margins.xl * 3,
    gap: theme.margins.md * 2,
  },
  previousButton: {
    flex: 1,
    paddingVertical: theme.margins.md * 4,
    paddingHorizontal: theme.margins.xl * 2,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.colors.limedSpruce,
    alignItems: 'center',
  },
  previousButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.typography,
  },
  nextButton: {
    flex: 1,
    paddingVertical: theme.margins.md * 4,
    paddingHorizontal: theme.margins.xl * 2,
    borderRadius: 12,
    backgroundColor: theme.colors.azureRadiance,
    alignItems: 'center',
  },
  nextButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
}));
