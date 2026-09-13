import { useCallback, useEffect, useState } from 'react';
import { BackHandler } from 'react-native';

import { deviceApi } from './src/api';
import {
  clearLegacyLocalSchedule,
  getPushToken,
  setupNotifications,
} from './src/notifications';

import { HomeScreen, type Route } from './src/screens/HomeScreen';
import { MilkScreen } from './src/screens/MilkScreen';
import { LaundryScreen } from './src/screens/LaundryScreen';
import { ShoppingScreen } from './src/screens/ShoppingScreen';

export default function App() {
  const [route, setRoute] = useState<Route>('home');

  const goHome = useCallback(() => setRoute('home'), []);

  /**
   * Register this phone for push once, on launch. Reminders come from the server
   * now, so a handset the server has never seen gets nothing — and the alarms an
   * earlier build left in Android's scheduler have to go, or everything fires twice.
   */
  useEffect(() => {
    (async () => {
      const granted = await setupNotifications();
      if (!granted) return;

      await clearLegacyLocalSchedule();

      const token = await getPushToken();
      if (!token) return;
      try {
        await deviceApi.register(token);
      } catch (error) {
        // Not fatal: the next launch tries again, and the app works regardless.
        console.warn('Could not register for push', error);
      }
    })();
  }, []);

  // Android hardware back: return to home instead of closing the app.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (route === 'home') return false;
      goHome();
      return true;
    });
    return () => subscription.remove();
  }, [route, goHome]);

  if (route === 'milk') return <MilkScreen onBack={goHome} />;
  if (route === 'shopping') return <ShoppingScreen onBack={goHome} />;
  if (route === 'laundry') return <LaundryScreen onBack={goHome} />;
  return <HomeScreen onNavigate={setRoute} />;
}
