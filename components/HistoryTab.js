import React, { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
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
  const [selectedDate, setSelectedDate] = useState('');
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
          const isSelected = dateStr === selectedDate;
          return (
            <TouchableOpacity
              onPress={() => {
                if (isMarked) {
                  setSelectedDate(dateStr === selectedDate ? '' : dateStr);
                }
              }}
              disabled={state === 'disabled'}
              style={{ flex: 1 }}
            >
              <View style={[styles.dayWrap, isMarked && styles.markedDay, isSelected && styles.selectedDay]}>
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
            </TouchableOpacity>
          );
        }}
      />
      {selectedDate ? (
        <View style={styles.entryContainer}>
          <Text style={styles.entryTitle}>Entry for {selectedDate}:</Text>
          {entries[selectedDate] ? (
            <>
              {Object.entries(entries[selectedDate]).map(([field, value]) => {
                if (typeof value === 'string' || typeof value === 'number') {
                  return (
                    <Text style={styles.entryText} key={field}>{field.charAt(0).toUpperCase() + field.slice(1)}: {value}</Text>
                  );
                } else if (Array.isArray(value)) {
                  return value.map((item, idx) => (
                    <Text style={styles.entryText} key={field + idx}>{field.charAt(0).toUpperCase() + field.slice(1)} {idx + 1}: {item}</Text>
                  ));
                } else if (typeof value === 'object' && value !== null) {
                  return Object.entries(value).map(([subKey, subValue]) => (
                    <Text style={styles.entryText} key={field + subKey}>{field.charAt(0).toUpperCase() + field.slice(1)} {subKey}: {subValue}</Text>
                  ));
                } else {
                  return null;
                }
              })}
            </>
          ) : (
            <Text style={styles.entryText}>No entry for this date.</Text>
          )}
        </View>
      ) : (
        <View style={styles.placeholderContainer}>
          <Text style={styles.placeholderText}>Select a date to see the entry</Text>
        </View>
      )}
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
  selectedDay: {
    backgroundColor: '#b3e0ff',
    borderRadius: 8,
  },
  entryContainer: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  entryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  entryText: {
    fontSize: 14,
    color: '#333',
  },
  placeholderContainer: {
    marginTop: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: 14,
    color: '#999',
  },
});

export default HistoryTab;
