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
import CheckHomeScreen from '../screens/check/CheckHomeScreen';
import NewCheckScreen from '../screens/check/NewCheckScreen';
import CheckEvaluationScreen from '../screens/check/CheckEvaluationScreen';
import CheckConnectObdScreen from '../screens/check/CheckConnectObdScreen';
import CheckDiagnosticCaptureScreen from '../screens/check/CheckDiagnosticCaptureScreen';
import CheckFindingsScreen from '../screens/check/CheckFindingsScreen';
import CheckReportScreen from '../screens/check/CheckReportScreen';
import HistoryScreen from '../screens/HistoryScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';

function TabBarIcon({ name, color }: { name: string; color: string }) {
  const iconMap: Record<string, string> = {
    garage: '🚗',
    live: '📈',
    check: '✓',
    history: '📜',
    settings: '⚙️',
  };
  return <Text style={{ color, fontSize: name === 'check' ? 27 : 24, fontWeight: name === 'check' ? '900' : '400' }}>{iconMap[name]}</Text>;
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
      <Stack.Screen name="CheckHome" component={CheckHomeScreen} />
      <Stack.Screen name="NewCheck" component={NewCheckScreen} />
      <Stack.Screen name="CheckEvaluation" component={CheckEvaluationScreen} />
      <Stack.Screen name="CheckConnectObd" component={CheckConnectObdScreen} />
      <Stack.Screen name="CheckDiagnosticCapture" component={CheckDiagnosticCaptureScreen} />
      <Stack.Screen name="CheckFindings" component={CheckFindingsScreen} />
      <Stack.Screen name="CheckReport" component={CheckReportScreen} />
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
        tabBarLabelStyle: { fontSize: 10 },
      }}
    >
      <Tab.Screen
        name="Garage"
        component={GarageStack}
        options={{ headerShown: false, tabBarIcon: ({ color }) => <TabBarIcon name="garage" color={color} /> }}
      />
      <Tab.Screen
        name="Live"
        component={LiveStack}
        options={{ headerShown: false, tabBarIcon: ({ color }) => <TabBarIcon name="live" color={color} /> }}
      />
      <Tab.Screen
        name="Check"
        component={CheckStack}
        options={{ headerShown: false, tabBarIcon: ({ color }) => <TabBarIcon name="check" color={color} /> }}
      />
      <Tab.Screen
        name="History"
        component={HistoryScreen}
        options={{ headerShown: false, tabBarIcon: ({ color }) => <TabBarIcon name="history" color={color} /> }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ headerShown: false, tabBarIcon: ({ color }) => <TabBarIcon name="settings" color={color} /> }}
      />
    </Tab.Navigator>
  );
}

export function NavigationRoot() {
  // Release 1 is local-first and has no cloud/account dependency. Product
  // access must not fail because an unrelated backend is unavailable.
  return (
    <NavigationContainer theme={DarkTheme}>
      <MainTabs />
    </NavigationContainer>
  );
}
