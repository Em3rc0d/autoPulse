import React from 'react';
import { Text } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';

import GarageScreen from '../screens/garage/GarageScreen';
import AddVehicleScreen from '../screens/garage/AddVehicleScreen';
import VehicleDetailScreen from '../screens/garage/VehicleDetailScreen';
import VehicleCapabilitiesScreen from '../screens/garage/VehicleCapabilitiesScreen';
import ConnectObdScreen from '../screens/live/ConnectObdScreen';
import InitializationScreen from '../screens/live/InitializationScreen';
import DriverLiveSessionScreen from '../screens/live/DriverLiveSessionScreen';
import SessionSummaryScreen from '../screens/live/SessionSummaryScreen';
import HistoryScreen from '../screens/HistoryScreen';
import CheckScreen from '../screens/check/CheckScreen';
import VehicleCheckReportScreen from '../screens/check/VehicleCheckReportScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';

function TabBarIcon({ name, color }: { name: string; color: string }) {
  const iconMap: Record<string, string> = {
    garage: '🚗',
    live: '📈',
    check: '✓',
    history: '📜',
    settings: '⚙️',
  };
  return <Text style={{ color, fontSize: 24 }}>{iconMap[name]}</Text>;
}

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function GarageStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="GarageHome" component={GarageScreen} />
      <Stack.Screen name="AddVehicle" component={AddVehicleScreen} />
      <Stack.Screen name="VehicleDetail" component={VehicleDetailScreen} />
      <Stack.Screen name="VehicleCapabilities" component={VehicleCapabilitiesScreen} />
    </Stack.Navigator>
  );
}

function LiveStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ConnectObd" component={ConnectObdScreen} />
      <Stack.Screen name="Initialization" component={InitializationScreen} />
      <Stack.Screen name="LiveSession" component={DriverLiveSessionScreen} />
      <Stack.Screen name="SessionSummary" component={SessionSummaryScreen} />
    </Stack.Navigator>
  );
}

function CheckStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="CheckHome" component={CheckScreen} />
      <Stack.Screen name="VehicleCheckReport" component={VehicleCheckReportScreen} />
    </Stack.Navigator>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#000', borderBottomWidth: 0, shadowOpacity: 0 },
        headerTintColor: '#fff',
        tabBarStyle: { backgroundColor: '#111', borderTopWidth: 0 },
        tabBarActiveTintColor: '#FF6B00',
        tabBarInactiveTintColor: '#8E8E93',
      }}
    >
      <Tab.Screen name="Garage" component={GarageStack} options={{ headerShown: false, tabBarIcon: ({ color }) => <TabBarIcon name="garage" color={color} /> }} />
      <Tab.Screen name="Live" component={LiveStack} options={{ headerShown: false, tabBarIcon: ({ color }) => <TabBarIcon name="live" color={color} /> }} />
      <Tab.Screen name="Check" component={CheckStack} options={{ headerShown: false, tabBarIcon: ({ color }) => <TabBarIcon name="check" color={color} /> }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ headerShown: false, tabBarIcon: ({ color }) => <TabBarIcon name="history" color={color} /> }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ headerShown: false, tabBarIcon: ({ color }) => <TabBarIcon name="settings" color={color} /> }} />
    </Tab.Navigator>
  );
}

export function NavigationRoot() {
  return (
    <NavigationContainer theme={DarkTheme}>
      <MainTabs />
    </NavigationContainer>
  );
}
