import { useCallback, useEffect, useState } from 'react';
import { BackHandler } from 'react-native';

import { HomeScreen, type Route } from './src/screens/HomeScreen';
import { MilkScreen } from './src/screens/MilkScreen';
import { LaundryScreen } from './src/screens/LaundryScreen';
import { ShoppingScreen } from './src/screens/ShoppingScreen';

export default function App() {
  const [route, setRoute] = useState<Route>('home');

  const goHome = useCallback(() => setRoute('home'), []);

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
