import * as React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import fonts from '../styles/fonts';

export default function HeroSection() {
  return (
    <View style={{ flex: 1 }}>
      <Text
        style={styles.title}>
        Welcome to Pixel Perfekt
      </Text>
      <Text
        style={styles.body}>
        The best design agency in the world.
      </Text>
      
    </View>
  );
}

const styles = StyleSheet.create({

  title: {
    fontSize: 48,
    padding: 20,
    marginVertical: 8,
    color: '#EDEFEE',
    textAlign: 'center',
    fontFamily: fonts.heading,
  },
  body: {
    fontSize: 24,
    padding: 20,
    marginVertical: 8,
    color: '#EDEFEE',
    textAlign: 'center',
    fontFamily: fonts.body,
  },

});