import * as React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import colors from '../styles/colors';
import fonts from '../styles/fonts';

export default function Footer() {
  return (
    <View
      style={styles.container}>
      <Text
        style={styles.bodyText}>
        All rights reserved by Pixel Perfekt Inc, 2024{' '}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({

  container: {
    backgroundColor: colors.primary,
    marginBottom: 10,
    padding: 10,
  },

  bodyText: {
    fontSize: 18,
    color: colors.black,
    textAlign: 'center',
    fontFamily: fonts.body
  },

});