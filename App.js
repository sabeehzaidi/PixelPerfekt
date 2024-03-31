import * as React from 'react';
import { View } from 'react-native';

import WelcomeScreen from "./components/HeroSection";
import Header from './components/Header';
import Footer from './components/Footer';
import HeroSection from './components/HeroSection';

export default function App() {
  return (
    <>
      <View
        style={{
          flex: 1,
          backgroundColor: 'black',
        }}>
        <Header/>
        <HeroSection />
        <Footer/>
      </View>
      <View style={{ backgroundColor: '#495E57' }}>
      </View>
    </>
  );
}
