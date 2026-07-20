import 'react-native-gesture-handler';
import React, { useContext } from 'react';
import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar, Text, View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import DashboardScreen from './src/screens/DashboardScreen';
import AnalyticsScreen from './src/screens/AnalyticsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import BluetoothScreen from './src/screens/BluetoothScreen';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import MechanicChatScreen from './src/screens/MechanicChatScreen';
import { AuthProvider, AuthContext } from './src/context/AuthContext';

function TabBarIcon({ name, color }: { name: string; color: string }) {
  const iconMap: Record<string, string> = {
    car: '🚗',
    analytics: '📈',
    history: '📜',
    bluetooth: '📶',
    chat: '👨‍🔧',
  };
  return <Text style={{ color, fontSize: 24 }}>{iconMap[name]}</Text>;
}

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#000', borderBottomWidth: 0, shadowOpacity: 0 },
        headerTintColor: '#fff',
        tabBarStyle: { backgroundColor: '#111', borderTopWidth: 0 },
        tabBarActiveTintColor: '#00D1FF',
        tabBarInactiveTintColor: '#8E8E93',
      }}
    >
      <Tab.Screen name="Inicio" component={DashboardScreen} options={{ headerShown: false, tabBarIcon: ({ color }) => <TabBarIcon name="car" color={color} /> }} />
      <Tab.Screen name="Análisis" component={AnalyticsScreen} options={{ headerShown: false, tabBarIcon: ({ color }) => <TabBarIcon name="analytics" color={color} /> }} />
      <Tab.Screen name="Historial" component={HistoryScreen} options={{ headerShown: false, tabBarIcon: ({ color }) => <TabBarIcon name="history" color={color} /> }} />
      <Tab.Screen name="Mecánico" component={MechanicChatScreen} options={{ headerShown: false, tabBarIcon: ({ color }) => <TabBarIcon name="chat" color={color} /> }} />
      <Tab.Screen name="Conexión" children={({ navigation }) => <BluetoothScreen onConnected={() => navigation.navigate('Inicio')} />} options={{ headerShown: false, tabBarIcon: ({ color }) => <TabBarIcon name="bluetooth" color={color} /> }} />
    </Tab.Navigator>
  );
}

function NavigationRoot() {
  const { token, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#00D1FF" />
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

import { useFonts } from 'expo-font';
import { SpaceGrotesk_400Regular, SpaceGrotesk_500Medium, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { SpaceMono_400Regular, SpaceMono_700Bold } from '@expo-google-fonts/space-mono';
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';

export default function App() {
  const [fontsLoaded] = useFonts({
    SpaceGrotesk_400Regular,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_700Bold,
    SpaceMono_400Regular,
    SpaceMono_700Bold,
    Inter_400Regular,
    Inter_500Medium,
  });

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: '#0e1417' }} />;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor="#0e1417" />
        <AuthProvider>
          <NavigationRoot />
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
