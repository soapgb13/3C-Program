import React, { useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';

// Helper to generate markedDates object for Calendar
const getMarkedDates = (entries) => {
  const marked = {};
  Object.keys(entries).forEach(date => {
    marked[date] = { marked: true };
  });
  return marked;
};

const getCurrentMonthFirstDay = () => {
  // Use context: October 9, 2025
  return '2025-10-01';
};

const HistoryTab = ({ entries = {} }) => {
  const markedDates = getMarkedDates(entries);
  const initialDate = getCurrentMonthFirstDay();

  return (
    <View style={styles.container}>
      <Calendar
        initialDate={initialDate}
        markingType={'custom'}
        markedDates={markedDates}
        dayComponent={({ date, state }) => {
          const dateStr = date.dateString;
          const isMarked = !!entries[dateStr];
          return (
            <View style={[styles.dayWrap, isMarked && styles.markedDay]}>
              <Text style={{ color: state === 'disabled' ? '#ccc' : '#222', fontWeight: 'bold' }}>
                {date.day}
              </Text>
              {isMarked && (
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color="#0b7cff"
                  style={styles.tickIcon}
                />
              )}
            </View>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  dayWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tickIcon: {
    position: 'absolute',
    top: 2,
    right: 2,
    zIndex: 1,
  },
  markedDay: {
    backgroundColor: '#e0ffe0',
    borderRadius: 8,
  },
});

export default HistoryTab;
