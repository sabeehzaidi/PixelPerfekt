import * as React from 'react';
import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import fonts from '../styles/fonts';
import colors from '../styles/colors';

export default function HeroSection() {
  return (
    <View style={styles.root}>
      <View style={styles.horizontalLayout}>
        <View style={styles.leftContent}>
          <Text
            style={styles.title}>
            WE MAKE PRODUCTS
          </Text>
          <Text style={styles.highlightText}>
            BETTER
          </Text>
        </View>
        <View style={styles.rightContent}>
          <Text
            style={styles.body}>
            The best design agency in the world.
          </Text>
          <Pressable onPress={() => onButtonPress('CTA')}>
            <Text style={styles.button}>Review my Product</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const onButtonPress = (text) => {
  console.log(`${text} button pressed`);
}

const styles = StyleSheet.create({

  root: {
    flex: 1
  },
  horizontalLayout: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.black,
  },
  leftContent: {
    flex: 1,
    justifyContent: 'left',
    alignItems: 'center',
    flexDirection: 'column'
  },
  rightContent: {
    flex: 1,
    justifyContent: 'right',
    alignItems: 'center',
    flexDirection: 'column',
    justifyContent: 'space-around'
  },
  title: {
    fontSize: 48,
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
  highlightText: {
    fontSize: 140,
    color: colors.primary,
    textAlign: 'center',
    fontFamily: fonts.heading,
    margin: -60
  },
  button: {
    color: colors.black,
    fontSize: 18,
    padding: 20,
    margin: 5,
    backgroundColor: colors.primary,
    borderRadius: 100,
    textAlign: 'center',
    fontFamily: fonts.heading,
  },

});