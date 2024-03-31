import { View, Text, Image, StyleSheet, Pressable } from 'react-native';
import colors from '../styles/colors';
import fonts from '../styles/fonts';

export default function Header() {
  return (
    <View style={styles.container}>
      <Image source={require('../assets/images/pixelperfektlogo.png')} style={styles.logo}/>

      <Pressable onPress={() => onButtonPress('HOW')}>
        <Text style={styles.button}>HOW IT'S DONE</Text>
      </Pressable>

      <Pressable onPress={() => onButtonPress('CONCEPTS')}>
        <Text style={styles.button}>RECENT CONCEPTS</Text>
      </Pressable>

      <Pressable onPress={() => onButtonPress('FAQ')}>
        <Text style={styles.button}>FAQ</Text>
      </Pressable>

    </View>
  );
}

const onButtonPress = (text) => {
  console.log(`${text} button pressed`);
};

const styles = StyleSheet.create({
  button: {
    color: colors.white,
    fontSize: 14,
    padding: 10,
    margin: 5,
    backgroundColor: colors.black,
    borderRadius: 5,
    textAlign: 'center',
    fontFamily: fonts.heading,
  },
  container: {
    flexDirection: 'row',
    justifyContent: 'space-around'
  },
  logo: {
    width: 30,
    height: 30,
    margin: 10,
  },

});
