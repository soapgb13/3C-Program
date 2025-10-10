import React, { useState } from 'react';
import { View, Text, Dimensions, StyleSheet, TouchableOpacity } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';

const chartWidth = Dimensions.get('window').width - 32;

const consistencyData = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  datasets: [{ data: [3, 4, 5, 2, 4, 5, 4], strokeWidth: 2 }],
};
const frequencyData = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  datasets: [{ data: [2, 3, 1, 4, 2, 3, 2], strokeWidth: 2 }],
};
const awarenessData = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  datasets: [{ data: [60, 70, 80, 75, 90, 85, 88], strokeWidth: 2 }],
};

function CollapsibleChart({ title, expanded, onToggle, data }) {
  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.headerRow} onPress={onToggle}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color="#333" />
      </TouchableOpacity>
      {expanded && (
        <LineChart
          data={data}
          width={chartWidth}
          height={220}
          chartConfig={chartConfig}
          style={{ marginVertical: 8, borderRadius: 16 }}
        />
      )}
    </View>
  );
}

const chartConfig = {
  backgroundColor: '#fff',
  backgroundGradientFrom: '#fff',
  backgroundGradientTo: '#fff',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(0, 122, 255, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
  style: { borderRadius: 16 },
};

export default function PerformanceTab() {
  const [expanded, setExpanded] = useState({
    consistency: true,
    frequency: false,
    awareness: false,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.title}>User Performance</Text>
      <CollapsibleChart
        title="Consistency"
        expanded={expanded.consistency}
        onToggle={() => setExpanded(e => ({ ...e, consistency: !e.consistency }))}
        data={consistencyData}
      />
      <CollapsibleChart
        title="3C Frequency"
        expanded={expanded.frequency}
        onToggle={() => setExpanded(e => ({ ...e, frequency: !e.frequency }))}
        data={frequencyData}
      />
      <CollapsibleChart
        title="Awareness Score"
        expanded={expanded.awareness}
        onToggle={() => setExpanded(e => ({ ...e, awareness: !e.awareness }))}
        data={awarenessData}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    backgroundColor: '#fff',
    paddingTop: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  section: {
    width: '100%',
    maxWidth: 600,
    backgroundColor: '#f7f7f8',
    borderRadius: 12,
    marginBottom: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
});
