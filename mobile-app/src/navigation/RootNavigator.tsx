import React, { useContext } from 'react';
import { View, ActivityIndicator, Text } from 'react-native';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';

import { AuthContext } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';

// Placeholders for new screens
import GarageScreen from '../screens/garage/GarageScreen';
import AddVehicleScreen from '../screens/garage/AddVehicleScreen';
import VehicleDetailScreen from '../screens/garage/VehicleDetailScreen';
import VehicleCapabilitiesScreen from '../screens/garage/VehicleCapabilitiesScreen';
import ConnectObdScreen from '../screens/live/ConnectObdScreen';
import InitializationScreen from '../screens/live/InitializationScreen';
import LiveSessionScreen from '../screens/live/LiveSessionScreen';
import SessionSummaryScreen from '../screens/live/SessionSummaryScreen';
import HistoryScreen from '../screens/HistoryScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';

function TabBarIcon({ name, color }: { name: string; color: string }) {
  const iconMap: Record<string, string> = {
    garage: '🚗',
    live: '📈',
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
      <Stack.Screen name="LiveSession" component={LiveSessionScreen} />
      <Stack.Screen name="SessionSummary" component={SessionSummaryScreen} />
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
        tabBarActiveTintColor: '#FF6B00', // Using Orange as primary action color
        tabBarInactiveTintColor: '#8E8E93',
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
  const { token, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FF6B00" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={DarkTheme}>
      {token ? (
        <MainTabs />
      ) : (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}
