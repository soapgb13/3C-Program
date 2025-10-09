import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const TopBar = ({ date, onClear, onDatePress }) => (
  <View style={styles.container}>
    <TouchableOpacity style={styles.dateButton} onPress={onDatePress}>
      <Text style={styles.dateText}>{date}</Text>
    </TouchableOpacity>
    <TouchableOpacity style={styles.clearButton} onPress={onClear}>
      <Text style={styles.clearText}>Clear</Text>
    </TouchableOpacity>
  </View>
);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    elevation: 4,
    zIndex: 100,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dateButton: {
    backgroundColor: '#eaf4ff',
    borderColor: '#0b7cff',
    borderWidth: 1,
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 18,
  },
  dateText: {
    color: '#0b7cff',
    fontWeight: 'bold',
    fontSize: 16,
    letterSpacing: 0.5,
  },
  clearButton: {
    backgroundColor: '#f55',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  clearText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default TopBar;
