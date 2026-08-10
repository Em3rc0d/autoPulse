import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop, Circle, Line as SvgLine, Text as SvgText } from 'react-native-svg';

export interface DataPoint {
  timestamp: number;
  value: number;
}

interface Props {
  dataPoints: DataPoint[];
  metricLabel: string;
  unit?: string;
  onPress: () => void;
  accentColor?: string;
  windowSeconds?: number;
}

function getNiceTicks(min: number, max: number, maxTicks = 4) {
  const range = max - min;
  if (range <= 0) return { ticks: [min], niceStep: 1 };
  
  const roughStep = range / (maxTicks - 1);
  const stepPower = Math.pow(10, Math.floor(Math.log10(roughStep)));
  const normalizedStep = roughStep / stepPower;
  
  let niceStep;
  if (normalizedStep < 1.5) niceStep = 1;
  else if (normalizedStep < 3) niceStep = 2;
  else if (normalizedStep < 7) niceStep = 5;
  else niceStep = 10;
  
  niceStep *= stepPower;
  
  const firstTick = Math.ceil(min / niceStep) * niceStep;
  const lastTick = Math.floor(max / niceStep) * niceStep;
  
  const ticks = [];
  for (let t = firstTick; t <= lastTick + (niceStep / 2); t += niceStep) {
    if (t >= min && t <= max) {
      ticks.push(t);
    }
  }
  return { ticks, niceStep };
}

export function LiveHistoryChart({ dataPoints, metricLabel, unit = '', onPress, accentColor = '#4ade80', windowSeconds = 30 }: Props) {
  const chartHeight = 240;
  const chartWidth = Dimensions.get('window').width - 32; 
  const paddingVertical = 24;
  const innerHeight = chartHeight - paddingVertical * 2;
  const paddingHorizontal = 8;
  const paddingLeftForLabels = unit ? 40 + unit.length * 6 : 40; // Adjust left padding for text labels
  const innerWidth = chartWidth - paddingLeftForLabels - paddingHorizontal;

  const { pathDef, areaDef, lastPoint, validData, yTicks, domainMin, domainRange, decimals } = useMemo(() => {
    if (!dataPoints || dataPoints.length === 0) return { pathDef: '', areaDef: '', lastPoint: null, validData: false, yTicks: [], domainMin: 0, domainRange: 1, decimals: 0 };
    
    const latestTimestamp = dataPoints[dataPoints.length - 1].timestamp;
    const windowStart = latestTimestamp - (windowSeconds * 1000);
    
    const windowPoints = dataPoints.filter(pt => pt.timestamp >= windowStart);
    if (windowPoints.length === 0) return { pathDef: '', areaDef: '', lastPoint: null, validData: false, yTicks: [], domainMin: 0, domainRange: 1, decimals: 0 };

    let minVal = windowPoints[0].value;
    let maxVal = windowPoints[0].value;
    for (let i = 1; i < windowPoints.length; i++) {
      if (windowPoints[i].value < minVal) minVal = windowPoints[i].value;
      if (windowPoints[i].value > maxVal) maxVal = windowPoints[i].value;
    }

    if (minVal === maxVal) {
      minVal -= 10;
      maxVal += 10;
    }
    const range = maxVal - minVal;
    const dMin = minVal - (range * 0.12);
    const dMax = maxVal + (range * 0.12);
    const dRange = dMax - dMin;

    const { ticks, niceStep } = getNiceTicks(dMin, dMax, 4);
    const dec = niceStep < 1 ? 1 : 0;

    const mapped = windowPoints.map(pt => {
      const x = paddingLeftForLabels + ((pt.timestamp - windowStart) / (windowSeconds * 1000)) * innerWidth;
      const y = paddingVertical + innerHeight - ((pt.value - dMin) / dRange) * innerHeight;
      return { x, y };
    });

    let path = `M ${mapped[0].x},${mapped[0].y}`;
    for (let i = 1; i < mapped.length; i++) {
      const prev = mapped[i - 1];
      const curr = mapped[i];
      const midX = (prev.x + curr.x) / 2;
      path += ` C ${midX},${prev.y} ${midX},${curr.y} ${curr.x},${curr.y}`;
    }

    const firstPt = mapped[0];
    const lastPt = mapped[mapped.length - 1];
    const areaPath = `${path} L ${lastPt.x},${chartHeight} L ${firstPt.x},${chartHeight} Z`;

    return { 
      pathDef: path, 
      areaDef: areaPath, 
      lastPoint: lastPt, 
      validData: true,
      yTicks: ticks,
      domainMin: dMin,
      domainRange: dRange,
      decimals: dec
    };
  }, [dataPoints, windowSeconds, innerWidth, innerHeight, chartHeight, paddingLeftForLabels]);

  return (
    <TouchableOpacity activeOpacity={0.8} onPress={onPress} style={styles.chartContainer}>
      <View style={styles.chartHeader}>
        <Text style={styles.chartTitle}>{metricLabel.toUpperCase()} HISTORY</Text>
        <Text style={styles.chartSubtitle}>{windowSeconds} SEC</Text>
      </View>

      <View style={styles.svgContainer}>
        {validData ? (
          <Svg width="100%" height={chartHeight}>
            <Defs>
              <LinearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={accentColor} stopOpacity="0.15" />
                <Stop offset="1" stopColor={accentColor} stopOpacity="0.0" />
              </LinearGradient>
            </Defs>
            
            {/* Y-Axis Grid & Labels */}
            {yTicks.map((val, idx) => {
              const y = paddingVertical + innerHeight - ((val - domainMin) / domainRange) * innerHeight;
              return (
                <React.Fragment key={idx}>
                  <SvgText
                    x={paddingLeftForLabels - 8}
                    y={y + 4}
                    fill="rgba(255,255,255,0.4)"
                    fontSize="11"
                    fontFamily="Inter_500Medium"
                    textAnchor="end"
                  >
                    {`${val.toFixed(decimals)}${unit ? ' ' + unit : ''}`}
                  </SvgText>
                  <SvgLine 
                    x1={paddingLeftForLabels} 
                    y1={y} 
                    x2={chartWidth - paddingHorizontal} 
                    y2={y} 
                    stroke="rgba(255,255,255,0.12)" 
                    strokeWidth="1" 
                    strokeDasharray="4, 4" 
                  />
                </React.Fragment>
              );
            })}

            {/* Area */}
            <Path d={areaDef} fill="url(#areaGradient)" />

            {/* Line */}
            <Path 
              d={pathDef} 
              fill="none" 
              stroke={accentColor} 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />

            {/* Current point marker */}
            {lastPoint && (
              <Circle 
                cx={lastPoint.x} 
                cy={lastPoint.y} 
                r="4.5" 
                fill="#1f2937" 
                stroke={accentColor} 
                strokeWidth="2.5" 
              />
            )}
          </Svg>
        ) : (
          <View style={[styles.emptyChart, { height: chartHeight }]}>
            <Text style={styles.emptyChartText}>Waiting for {metricLabel} data...</Text>
          </View>
        )}
      </View>

      <View style={styles.chartFooter}>
        <Text style={styles.chartFooterText}>View details  ›</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chartContainer: {
    backgroundColor: '#1f2937',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#374151',
    marginBottom: 16,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  chartTitle: { 
    color: '#d1d5db', 
    fontSize: 12, 
    fontFamily: 'Inter_700Bold',
    letterSpacing: 1
  },
  chartSubtitle: {
    color: '#6b7280',
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
  },
  svgContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  emptyChart: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyChartText: {
    color: '#6b7280',
    fontFamily: 'Inter_500Medium',
  },
  chartFooter: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  chartFooterText: {
    color: '#9ca3af',
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
  }
});
