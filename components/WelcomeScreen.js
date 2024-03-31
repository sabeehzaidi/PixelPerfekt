import * as React from 'react';
import { View, Text, Image } from 'react-native';

export default function WelcomeScreen() {
  return (
    <View style={{ flex: 1 }}>
      <Text
        style={{
          padding: 40,
          fontSize: 50,
          color: '#EDEFEE',
          textAlign: 'center',
        }}>
        Welcome to Pixel Perfekt
      </Text>
      <Text
        style={{
          fontSize: 38,
          padding: 20,
          marginVertical: 8,
          color: '#EDEFEE',
          textAlign: 'center',
        }}>
        The best design agency in the world.
      </Text>
      
    </View>
  );
}
