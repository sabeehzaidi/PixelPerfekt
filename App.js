import * as React from 'react';
import { View } from 'react-native';

import WelcomeScreen from "./components/WelcomeScreen";
import Header from './components/Header';
import Footer from './components/Footer';

export default function App() {
  return (
    <>
      <View
        style={{
          flex: 1,
          backgroundColor: 'black',
        }}>
        <Header/>
        <WelcomeScreen />
        <Footer/>
      </View>
      <View style={{ backgroundColor: '#495E57' }}>
      </View>
    </>
  );
}
