import React, { useState } from 'react';
import { View, Text, Dimensions, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { Ionicons } from '@expo/vector-icons';
import { G, Circle, Rect, Text as SvgText } from 'react-native-svg';

const chartWidth = Dimensions.get('window').width - 32;

function getLastNDays(entries, n = 7) {
  const allDates = Object.keys(entries || {}).sort((a, b) => a.localeCompare(b));
  return allDates.slice(-n);
}

function getConsistencyData(entries) {
  const lastDates = getLastNDays(entries, 7);
  const labels = lastDates.map(date => {
    const [, month, day] = date.split('-');
    return `${month}/${day}`;
  });
  const data = lastDates.map(date => {
    const entry = entries[date] || {};
    let count = 0;
    // Morning gratitude (array of 3)
    if (entry.morning && Array.isArray(entry.morning.gratitude)) {
      count += entry.morning.gratitude.filter(g => g && g.trim()).length;
    }
    // Night wentWell, handled, improve (3 fields)
    if (entry.night) {
      if (entry.night.wentWell && entry.night.wentWell.trim()) count += 1;
      if (entry.night.handled && entry.night.handled.trim()) count += 1;
      if (entry.night.improve && entry.night.improve.trim()) count += 1;
    }
    // Calculate percentage out of 6
    return Math.round((count / 6) * 100);
  });
  // Provide legend and explicit color so this chart can use the shared interactive legend behavior
  return {
    labels,
    // fullLabels contains the original ISO-style date keys (YYYY-MM-DD) for tooltips
    fullLabels: lastDates,
    legend: ['Entry Completion (%)'],
    datasets: [{ data, strokeWidth: 2, color: () => `rgba(10, 132, 255, 1)` }],
    yAxisMin: 0,
    yAxisMax: 100,
  };
}

// New: compute Gratitude (morning) and Complaint (midday) frequencies for the last N days.
// Gratitude: count of non-empty items in morning.gratitude (0..3) normalized to 0..100
// Complaint: whether the user checked the first midday.caught checkbox ("Complaining") -> treated as 0 or 100
function getGratitudeAndComplaintData(entries, n = 7) {
  const lastDates = getLastNDays(entries, n);
  const labels = lastDates.map(date => {
    const [, month, day] = date.split('-');
    return `${month}/${day}`;
  });

  const gratitudeData = [];
  const complaintData = [];

  lastDates.forEach(date => {
    const entry = entries[date] || {};
    // Gratitude: up to 3 items
    let gratitudeCount = 0;
    if (entry.morning && Array.isArray(entry.morning.gratitude)) {
      gratitudeCount = entry.morning.gratitude.filter(g => g && g.trim()).length;
    }
    const gratitudePct = Math.round((gratitudeCount / 3) * 100);
    gratitudeData.push(gratitudePct);

    // Complaint: treat midday.caught[0] ("Complaining") as the complaint flag
    let complained = false;
    if (entry.midday && Array.isArray(entry.midday.caught)) {
      complained = !!entry.midday.caught[0];
    }
    const complaintPct = complained ? 100 : 0;
    complaintData.push(complaintPct);
  });

  return {
    labels,
    // fullLabels contains the original ISO-style date keys (YYYY-MM-DD) for tooltips
    fullLabels: lastDates,
    // Provide clearer legend labels in the same order as datasets so the legend UI is unambiguous
    legend: ['% Days with Complaint', '% Gratitude Items Filled'],
    datasets: [
      { data: complaintData, strokeWidth: 2, color: () => `rgba(220, 38, 38, 1)` }, // Red = Complaints
      // Gratitude line: set to green
      { data: gratitudeData, strokeWidth: 2, color: () => `rgba(16, 185, 129, 1)` }, // Green = Gratitude
    ],
  };
}

const chartConfig = {
  // Light, airy gradient to sit on the card background
  backgroundColor: '#ffffff',
  backgroundGradientFrom: '#f8fafc',
  backgroundGradientTo: '#ffffff',
  decimalPlaces: 0,
  // Default line & label color (opacity-aware)
  color: (opacity = 1) => `rgba(33, 37, 41, ${opacity})`,
  // Keep the chart visually subtle: softer grid lines
  style: { borderRadius: 16 },
  propsForBackgroundLines: { stroke: '#e9eef6', strokeWidth: 0.8 },
  // Hide default dots (radius 0) so our custom ring markers are the only visible points
  propsForDots: { r: '0' },
};

function CollapsibleChart({ title, expanded, onToggle, data, enableFillUnderLine = false, fillColor }) {
  // Track which datasets are visible (for legend toggling). Initialize to all true.
  const [visible, setVisible] = React.useState(() => (data && Array.isArray(data.datasets) ? data.datasets.map(() => true) : []));

  // Tooltip state (rendered as an absolutely positioned RN Animated.View)
  const [tooltip, setTooltip] = React.useState({ visible: false, x: 0, y: 0, index: null, value: null, label: '' });
  const [chartLayout, setChartLayout] = React.useState(null); // { x, y, width, height }
  const tooltipAnim = React.useRef(new Animated.Value(0)).current;

  // Reset visibility if incoming data size changes
  React.useEffect(() => {
    if (data && Array.isArray(data.datasets)) {
      setVisible(prev => {
        if (prev.length !== data.datasets.length) return data.datasets.map(() => true);
        return prev;
      });
    }
  }, [data]);

  // Hide tooltip when collapsing the chart
  React.useEffect(() => {
    if (!expanded && tooltip.visible) {
      setTooltip({ visible: false, x: 0, y: 0, index: null, value: null, label: '' });
    }
  }, [expanded]);

  // Animate tooltip appearance/disappearance
  React.useEffect(() => {
    Animated.timing(tooltipAnim, {
      toValue: tooltip.visible ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [tooltip.visible]);

  // Custom dot renderer for ring markers and dot-press tooltip
  const renderDotContent = ({ x, y, index, indexData }) => {
    // Draw rings for all visible datasets that have a value equal to indexData at this index.
    // This avoids choosing the wrong dataset color when multiple series share the same y value.
    const rings = [];
    const datasets = data && Array.isArray(data.datasets) ? data.datasets : [];
    datasets.forEach((ds, dsIdx) => {
      if (!visible[dsIdx]) return; // skip hidden series
      const v = Array.isArray(ds.data) ? ds.data[index] : undefined;
      if (v === indexData) {
        const color = (typeof ds.color === 'function') ? ds.color(1) : (typeof chartConfig.color === 'function' ? chartConfig.color(1) : '#333');
        rings.push({ color });
      }
    });

    // If no matching visible dataset found (edge cases), draw a default ring
    if (rings.length === 0) {
      rings.push({ color: chartConfig.color(1) });
    }

    // Unique key per rendered dot (based on position + index)
    const uniqueKey = `dot-${Math.round(x)}-${Math.round(y)}-${index}`;

    // Allow tapping a ring to show the RN tooltip overlay. We store the SVG coordinates (x/y)
    // and the index/value; the overlay will be positioned using the measured chart layout.
    return (
      <G key={uniqueKey}>
        {rings.map((r, i) => (
          <Circle
            key={`${uniqueKey}-r-${i}`}
            cx={x}
            cy={y}
            r={5 + i * 3}
            fill={chartConfig.backgroundColor || '#fff'}
            stroke={r.color}
            strokeWidth={2}
            onPress={() => {
              const isoLabel = (data.fullLabels && data.fullLabels[index]) ? data.fullLabels[index] : ((data.labels && data.labels[index]) ? data.labels[index] : '');
              setTooltip({ visible: true, x, y, index, value: indexData, label: isoLabel });
            }}
          />
        ))}
      </G>
    );
  };

  return (
    <View style={styles.section}>
      <TouchableOpacity style={styles.headerRow} onPress={onToggle}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color="#333" />
      </TouchableOpacity>
      {expanded && (() => {
        // Prevent react-native-chart-kit from rendering its built-in legend.
        // The library renders a legend automatically when `data.legend` exists.
        // Create a shallow copy without the legend and pass that to the chart.
        const chartData = { ...data };
        if (chartData && Object.prototype.hasOwnProperty.call(chartData, 'legend')) {
          delete chartData.legend;
        }
        chartData.datasets = (data && Array.isArray(data.datasets)) ? data.datasets.map((ds, idx) => (visible[idx] ? ds : null)).filter(Boolean) : [];

        // If no datasets are visible, don't render the chart; show a placeholder message instead.
        if (!chartData.datasets || chartData.datasets.length === 0) {
          return (
            <View style={{ padding: 20, alignItems: 'center' }}>
              <Text style={{ color: '#666' }}>No series selected — tap a legend item to show it.</Text>
            </View>
          );
        }

        // Determine fill gradient color: use passed fillColor or the first visible dataset color
        let activeFillColor = fillColor;
        if (!activeFillColor && Array.isArray(data.datasets)) {
          const firstVisibleIndex = data.datasets.findIndex((ds, i) => visible[i]);
          if (firstVisibleIndex >= 0) {
            const ds = data.datasets[firstVisibleIndex];
            activeFillColor = (typeof ds.color === 'function') ? ds.color(0.2) : undefined;
          }
        }

        const localChartConfig = {
          ...chartConfig,
          fillShadowGradient: enableFillUnderLine && activeFillColor ? activeFillColor : '#ffffff',
          fillShadowGradientOpacity: enableFillUnderLine ? 0.12 : 0,
        };

        return (
          <View
            style={{ position: 'relative' }}
            onLayout={e => {
              const { x, y, width, height } = e.nativeEvent.layout;
              setChartLayout({ x, y, width, height });
            }}
          >
            {/* Tap-out overlay to auto-dismiss tooltip when visible */}
            {tooltip.visible && (
              <TouchableOpacity
                activeOpacity={1}
                onPress={() => setTooltip({ visible: false, x: 0, y: 0, index: null, value: null, label: '' })}
                style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, zIndex: 10 }}
              />
            )}

            <LineChart
              data={chartData}
              width={chartWidth}
              height={240}
              chartConfig={localChartConfig}
              style={{ marginVertical: 8, borderRadius: 16 }}
              fromZero={true}
              yAxisSuffix="%"
              yAxisInterval={20}
              segments={5}
              yLabelsOffset={8}
              // No bezier: straight lines
              // (do not pass bezier prop)
              yAxisMin={0}
              yAxisMax={100}
              withShadow={false}
              renderDotContent={renderDotContent}
            />

            {/* RN Animated tooltip overlay positioned using chartLayout + SVG x/y coordinates */}
            {tooltip.visible && chartLayout && (
              (() => {
                const TOOLTIP_W = 120;
                const TOOLTIP_H = 48;
                // Chart layout x,y are relative to parent View. We want tooltip left/top relative to this container.
                let left = tooltip.x - TOOLTIP_W / 2;
                // clamp horizontally inside chart
                const minLeft = 6;
                const maxLeft = chartLayout.width - TOOLTIP_W - 6;
                if (left < minLeft) left = minLeft;
                if (left > maxLeft) left = maxLeft;

                let top = tooltip.y - TOOLTIP_H - 8;
                // If not enough space above, place below the point
                if (top < 6) top = tooltip.y + 8;

                const animatedStyle = {
                  position: 'absolute',
                  left,
                  top,
                  width: TOOLTIP_W,
                  height: TOOLTIP_H,
                  zIndex: 20,
                  transform: [
                    { scale: tooltipAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
                  ],
                  opacity: tooltipAnim,
                };

                return (
                  <Animated.View style={animatedStyle} pointerEvents="box-none">
                    <View style={{ flex: 1, backgroundColor: 'rgba(33,37,41,0.95)', borderRadius: 8, padding: 8, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600' }}>{tooltip.label}</Text>
                      <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>{`${tooltip.value}%`}</Text>
                    </View>
                  </Animated.View>
                );
              })()
            )}
          </View>
        );
      })()}
       {/* Render a simple legend when data.legend is present and datasets are available */}
       {expanded && data && Array.isArray(data.datasets) && Array.isArray(data.legend) && (
         <View style={{ flexDirection: 'row', justifyContent: 'flex-start', marginTop: 8, flexWrap: 'wrap' }}>
           {data.legend.map((label, idx) => {
             const ds = data.datasets[idx] || {};
             const color = (typeof ds.color === 'function') ? ds.color(1) : (typeof chartConfig.color === 'function' ? chartConfig.color(1) : '#333');
             const isVisible = !!visible[idx];
             return (
               <TouchableOpacity
                 key={`legend-${idx}`}
                 onPress={() => {
                   // Hide tooltip when legend toggles
                   if (tooltip.visible) setTooltip({ visible: false, x: 0, y: 0, index: null, value: null, label: '' });
                   setVisible(prev => {
                     const copy = [...prev];
                     copy[idx] = !copy[idx];
                     return copy;
                   });
                 }}
                 style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16, opacity: isVisible ? 1 : 0.45 }}
               >
                 <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color, marginRight: 6 }} />
                 <Text style={{ color: isVisible ? '#333' : '#999' }}>{label}</Text>
               </TouchableOpacity>
             );
           })}
         </View>
       )}
     </View>
   );
}

export default function PerformanceTab({ entries = {} }) {
  const [expanded, setExpanded] = useState({
    consistency: true,
    frequency: false,
    awareness: false,
  });

  const consistencyData = getConsistencyData(entries);

  // Compute the combined dataset: Complaints (midday) and Gratitude (morning)
  const combinedData = getGratitudeAndComplaintData(entries, 7);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>User Performance</Text>
      <CollapsibleChart
        title="Entry Completion (Last 7 days)"
        expanded={expanded.consistency}
        onToggle={() => setExpanded(e => ({ ...e, consistency: !e.consistency }))}
        data={consistencyData}
        enableFillUnderLine={true}
        fillColor="rgba(10, 132, 255, 0.2)"
      />
      <CollapsibleChart
        title="Gratitude vs Complaints (Last 7 days)"
        expanded={expanded.frequency}
        onToggle={() => setExpanded(e => ({ ...e, frequency: !e.frequency }))}
        data={combinedData}
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
