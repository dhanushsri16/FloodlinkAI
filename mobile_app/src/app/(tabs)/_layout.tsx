import React from 'react';
import { Text } from 'react-native';
import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#1769AA',
        tabBarInactiveTintColor: '#8A98A8',
        tabBarStyle: {
          height: 65,
          paddingBottom: 8,
          paddingTop: 6,
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5EBF1',
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: () => <Text>🏠</Text>,
        }}
      />

      <Tabs.Screen
        name="map"
        options={{
          title: 'Map',
          tabBarIcon: () => <Text>🗺️</Text>,
        }}
      />

      <Tabs.Screen
        name="analysis"
        options={{
          title: 'Analysis',
          tabBarIcon: () => <Text>📊</Text>,
        }}
      />

      <Tabs.Screen
        name="alerts"
        options={{
          title: 'Alerts',
          tabBarIcon: () => <Text>🚨</Text>,
        }}
      />

      <Tabs.Screen
        name="ai"
        options={{
          title: 'AI',
          tabBarIcon: () => <Text>🤖</Text>,
        }}
      />
    </Tabs>
  );
}