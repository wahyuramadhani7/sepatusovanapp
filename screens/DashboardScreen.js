import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert, Modal, ScrollView, Animated, ImageBackground } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function DashboardScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalUnits, setTotalUnits] = useState(0);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [totalSales, setTotalSales] = useState(0);
  const [hourlyData, setHourlyData] = useState([]);
  const [hourlyLabels, setHourlyLabels] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const slideAnim = useState(new Animated.Value(-300))[0];
  const fadeAnim = useState(new Animated.Value(0))[0];

  // Animated Number Component
  const AnimatedNumber = ({ value, prefix = '', suffix = '' }) => {
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
      const duration = 1500;
      const steps = 60;
      const stepValue = value / steps;
      let current = 0;

      const timer = setInterval(() => {
        current += stepValue;
        if (current >= value) {
          current = value;
          clearInterval(timer);
        }
        setDisplayValue(Math.floor(current));
      }, duration / steps);

      return () => clearInterval(timer);
    }, [value]);

    return (
      <Text style={styles.animatedNumber}>
        {prefix}{displayValue.toLocaleString('id-ID')}{suffix}
      </Text>
    );
  };

  // StatCard Component
  const StatCard = ({ title, value, icon, delay = 0 }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, delay);
      return () => clearTimeout(timer);
    }, [delay]);

    return (
      <Animated.View
        style={[
          styles.statCard,
          {
            opacity: isVisible ? 1 : 0,
            transform: [{ translateY: isVisible ? 0 : 20 }],
          },
        ]}
      >
        <LinearGradient colors={['#E5E7EB', '#FFFFFF']} style={styles.statCardGradient}>
          <View style={styles.statCardHeader}>
            <Text style={styles.statCardTitle}>{title}</Text>
          </View>
          <View style={styles.statCardContent}>
            <View style={styles.statCardIcon}>
              <Text style={styles.statCardIconText}>{icon}</Text>
            </View>
            <View style={styles.statCardValue}>
              {title.includes('Penjualan') ? (
                <AnimatedNumber value={value} prefix="Rp " />
              ) : (
                <AnimatedNumber value={value} />
              )}
            </View>
          </View>
        </LinearGradient>
      </Animated.View>
    );
  };

  // SimpleBarChart Component
  const SimpleBarChart = ({ data, labels, title, subtitle }) => {
    const maxValue = Math.max(...data, 1);
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];

    return (
      <View style={styles.barChartContainer}>
        <Text style={styles.chartTitle}>{title}</Text>
        <Text style={styles.chartSubtitle}>{subtitle}</Text>
        {data.length === 0 ? (
          <Text style={styles.noDataText}>Tidak ada data untuk ditampilkan</Text>
        ) : (
          <>
            <View style={styles.barContainer}>
              {data.map((value, index) => (
                <View key={index} style={styles.barItem}>
                  <Animated.View
                    style={[
                      styles.bar,
                      {
                        height: (value / maxValue) * 100,
                        backgroundColor: colors[index % colors.length],
                        animationDelay: `${index * 100}ms`,
                      },
                    ]}
                  />
                  <Text style={styles.barValue}>{value}</Text>
                </View>
              ))}
            </View>
            <View style={styles.barLabels}>
              {labels.map((label, index) => (
                <Text key={index} style={styles.barLabel}>
                  {label.length > 8 ? label.substring(0, 8) + '...' : label}
                </Text>
              ))}
            </View>
          </>
        )}
      </View>
    );
  };

  // SimplePieChart Component
  const SimplePieChart = ({ data, title, subtitle }) => {
    const total = data.reduce((sum, item) => sum + item.quantity, 0);
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'];

    return (
      <View style={styles.pieChartContainer}>
        <Text style={styles.chartTitle}>{title}</Text>
        <Text style={styles.chartSubtitle}>{subtitle}</Text>
        {data.length === 0 ? (
          <Text style={styles.noDataText}>Tidak ada data untuk ditampilkan</Text>
        ) : (
          data.map((item, index) => (
            <View key={index} style={styles.pieItem}>
              <View
                style={[
                  styles.pieColor,
                  { backgroundColor: colors[index % colors.length] },
                ]}
              />
              <View style={styles.pieTextContainer}>
                <Text style={styles.pieName}>{item.name || '-'}</Text>
                <Text style={styles.pieCount}>{item.quantity || 0} unit</Text>
              </View>
              <Text style={styles.piePercentage}>
                {((item.quantity / total) * 100).toFixed(1)}%
              </Text>
            </View>
          ))
        )}
      </View>
    );
  };

  // TransactionTable Component
  const TransactionTable = ({ transactions }) => {
    return (
      <View style={styles.tableContainer}>
        <Text style={styles.sectionTitle}>Detail Transaksi</Text>
        {transactions.length === 0 ? (
          <Text style={styles.noDataText}>Tidak ada transaksi hari ini</Text>
        ) : (
          <ScrollView horizontal={true} showsHorizontalScrollIndicator={true} style={styles.tableScroll}>
            <View style={styles.tableContent}>
              <View style={styles.tableHeader}>
                <Text style={[styles.tableHeaderCell, styles.cellId]}>ID</Text>
                <Text style={[styles.tableHeaderCell, styles.cellDate]}>Tanggal</Text>
                <Text style={[styles.tableHeaderCell, styles.cellUser]}>Kasir</Text>
                <Text style={[styles.tableHeaderCell, styles.cellProducts]}>Produk</Text>
                <Text style={[styles.tableHeaderCell, styles.cellAmount]}>Total</Text>
                <Text style={[styles.tableHeaderCell, styles.cellStatus]}>Status</Text>
              </View>
              <FlatList
                data={transactions}
                renderItem={renderTransaction}
                keyExtractor={(item, index) => item.id?.toString() || `transaction-${index}`}
                nestedScrollEnabled={true}
                scrollEnabled={false}
                initialNumToRender={10}
                maxToRenderPerBatch={10}
                windowSize={5}
              />
            </View>
          </ScrollView>
        )}
      </View>
    );
  };

  // Fetch data from API
  const fetchData = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (!token) {
        throw new Error('Token tidak ditemukan. Silakan login ulang.');
      }

      const response = await axios.get('http://192.168.1.6:8000/api/dashboard', {
        headers: { Authorization: `Bearer ${token}` },
      });

      const {
        total_products = 0,
        total_transactions = 0,
        total_sales = '0',
        hourly_data = [],
        labels = [],
        top_products = [],
        recent_transactions = [],
      } = response.data.data || {};

      if (
        totalUnits !== total_products ||
        totalTransactions !== total_transactions ||
        totalSales !== parseFloat(total_sales) ||
        JSON.stringify(hourlyData) !== JSON.stringify(hourly_data) ||
        JSON.stringify(hourlyLabels) !== JSON.stringify(labels) ||
        JSON.stringify(topProducts) !== JSON.stringify(top_products) ||
        JSON.stringify(recentTransactions) !== JSON.stringify(recent_transactions)
      ) {
        setTotalUnits(total_products);
        setTotalTransactions(total_transactions);
        setTotalSales(parseFloat(total_sales) || 0);
        setHourlyData(hourly_data);
        setHourlyLabels(labels);
        setTopProducts(top_products);
        setRecentTransactions(recent_transactions);
      }

      setLoading(false);
    } catch (error) {
      const errorMsg = error.response?.status === 401
        ? 'Sesi login habis. Silakan login ulang.'
        : 'Gagal mengambil data dari API';
      setError(errorMsg);
      setLoading(false);
      Alert.alert('Error', errorMsg, [
        { text: 'OK', onPress: () => navigation.replace('Login') },
      ]);
    }
  }, [totalUnits, totalTransactions, totalSales, hourlyData, hourlyLabels, topProducts, recentTransactions, navigation]);

  // Polling every 5 seconds
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Menu and card animations
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: menuVisible ? 0 : -300,
      duration: 300,
      useNativeDriver: true,
    }).start();

    Animated.timing(fadeAnim, {
      toValue: loading ? 0 : 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, [menuVisible, loading]);

  const handleLogout = async () => {
    await AsyncStorage.removeItem('token');
    navigation.replace('Login');
    setMenuVisible(false);
  };

  // Filter hourly data up to current hour
  const currentHour = new Date().getHours();
  const filteredHourlyData = hourlyData.slice(0, currentHour + 1).filter(data => data > 0);
  const filteredHourlyLabels = hourlyLabels.slice(0, currentHour + 1).filter((_, index) => hourlyData[index] > 0);

  // Render transaction row
  const renderTransaction = ({ item, index }) => {
    const rowStyle = index % 2 === 0 ? styles.tableRowEven : styles.tableRowOdd;
    return (
      <View style={[styles.tableRow, rowStyle]}>
        <Text style={[styles.tableCell, styles.cellId]} numberOfLines={1} ellipsizeMode="tail">
          {item.id || '-'}
        </Text>
        <Text style={[styles.tableCell, styles.cellDate]} numberOfLines={1} ellipsizeMode="tail">
          {item.created_at || '-'}
        </Text>
        <Text style={[styles.tableCell, styles.cellUser]} numberOfLines={1} ellipsizeMode="tail">
          {item.user?.name || 'Unknown'}
        </Text>
        <Text style={[styles.tableCell, styles.cellProducts]} numberOfLines={2} ellipsizeMode="tail">
          {item.items?.length ? item.items.map(i => i.product?.name || '-').join(', ') : '-'}
        </Text>
        <Text style={[styles.tableCell, styles.cellAmount]} numberOfLines={1} ellipsizeMode="tail">
          Rp {(item.final_amount || 0).toLocaleString('id-ID')}
        </Text>
        <Text style={[styles.tableCell, styles.cellStatus, { color: '#10B981' }]} numberOfLines={1} ellipsizeMode="tail">
          {item.status || '-'}
        </Text>
      </View>
    );
  };

  // Render header for FlatList
  const renderHeader = () => {
    const [headerVisible, setHeaderVisible] = useState(false);

    useEffect(() => {
      setTimeout(() => {
        setHeaderVisible(true);
      }, 500);
    }, []);

    return (
      <View>
        {/* Hero Section */}
        <ImageBackground
          source={{ uri: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2574&q=80' }}
          style={styles.heroSection}
        >
          <View style={styles.heroOverlay} />
          <Animated.View
            style={[
              styles.heroTextContainer,
              {
                opacity: headerVisible ? 1 : 0,
                transform: [{ scale: headerVisible ? 1 : 0.75 }],
              },
            ]}
          >
            <Text style={styles.heroText}>@SEPATUBYSOVAN</Text>
          </Animated.View>
          <TouchableOpacity style={styles.hamburgerButton} onPress={() => setMenuVisible(true)}>
            <Ionicons name="menu" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </ImageBackground>

        {/* Main Content */}
        <View style={styles.content}>
          {/* Daily Report Section */}
          <Text style={styles.sectionTitle}>LAPORAN HARIAN</Text>
          <Animated.View style={[styles.cardContainer, { opacity: fadeAnim }]}>
            <StatCard
              title="Total Unit"
              value={totalUnits}
              icon="👟"
              delay={200}
            />
            <StatCard
              title="Transaksi Hari Ini"
              value={totalTransactions}
              icon="🛒"
              delay={400}
            />
            <StatCard
              title="Penjualan Hari Ini"
              value={totalSales}
              icon="💰"
              delay={600}
            />
          </Animated.View>

          {/* Charts Section */}
          <View style={styles.chartsContainer}>
            <SimpleBarChart
              data={topProducts.map(p => p.quantity || 0)}
              labels={topProducts.map(p => p.name || '-')}
              title="Produk Terlaris"
              subtitle={`Laporan Produk Terlaris Bulan Ini (${new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' })})`}
            />
            <SimplePieChart
              data={topProducts}
              title="Distribusi Unit per Produk"
              subtitle={`Jumlah Unit per Produk (${new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' })})`}
            />
          </View>

          {/* Transactions Table */}
          <TransactionTable transactions={recentTransactions} />
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3B82F6" />
        <Text style={styles.loadingText}>Memuat Data...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
        <TouchableOpacity style={styles.button} onPress={() => navigation.replace('Login')}>
          <Text style={styles.buttonText}>Kembali ke Login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={[{ key: 'dashboard' }]}
        renderItem={() => null}
        ListHeaderComponent={renderHeader}
      />
      <Modal
        animationType="none"
        transparent={true}
        visible={menuVisible}
        onRequestClose={() => setMenuVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.modalContainer, { transform: [{ translateX: slideAnim }] }]}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setMenuVisible(false)}>
              <Ionicons name="close" size={26} color="#FFFFFF" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                navigation.navigate('Inventory');
                setMenuVisible(false);
              }}
            >
              <Text style={styles.menuText}>Lihat Inventory</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                navigation.navigate('Transaction');
                setMenuVisible(false);
              }}
            >
              <Text style={styles.menuText}>Buat Transaksi</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                navigation.navigate('Visitor');
                setMenuVisible(false);
              }}
            >
              <Text style={styles.menuText}>Monitoring Pengunjung</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.menuItem, styles.logoutButton]} onPress={handleLogout}>
              <Text style={styles.menuText}>Logout</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    maxWidth: 414,
    alignSelf: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  loadingText: {
    color: '#1E3A8A',
    fontSize: 18,
    marginTop: 16,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#F3F4F6',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: '600',
    lineHeight: 28,
  },
  button: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroSection: {
    height: 192,
    position: 'relative',
    overflow: 'hidden',
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
  },
  heroTextContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  heroText: {
    color: '#F97316',
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'serif',
    textAlign: 'center',
  },
  hamburgerButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    padding: 12,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  content: {
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginVertical: 24,
    color: '#1E3A8A',
    textTransform: 'uppercase',
  },
  cardContainer: {
    marginBottom: 32,
  },
  statCard: {
    marginBottom: 16,
  },
  statCardGradient: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#93C5FD',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  statCardHeader: {
    backgroundColor: '#EFF6FF',
    padding: 8,
  },
  statCardTitle: {
    color: '#1F2937',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  statCardContent: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    padding: 16,
  },
  statCardIcon: {
    width: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  statCardIconText: {
    fontSize: 24,
  },
  statCardValue: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  animatedNumber: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  chartsContainer: {
    marginBottom: 32,
  },
  barChartContainer: {
    backgroundColor: '#1F2937',
    borderRadius: 8,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  chartTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  chartSubtitle: {
    color: '#9CA3AF',
    fontSize: 12,
    marginBottom: 16,
  },
  barContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    height: 128,
    marginBottom: 16,
  },
  barItem: {
    alignItems: 'center',
    flex: 1,
  },
  bar: {
    width: 32,
    borderTopLeftRadius: 4,
    borderTopRightRadius: 4,
  },
  barValue: {
    color: '#D1D5DB',
    fontSize: 12,
    marginTop: 8,
  },
  barLabels: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  barLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
    flex: 1,
  },
  pieChartContainer: {
    backgroundColor: '#1F2937',
    borderRadius: 8,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  pieItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  pieColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
    marginRight: 12,
  },
  pieTextContainer: {
    flex: 1,
  },
  pieName: {
    color: '#FFFFFF',
    fontSize: 14,
  },
  pieCount: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  piePercentage: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  tableContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  tableScroll: {
    flexGrow: 0,
  },
  tableContent: {
    minWidth: 850,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#1F2937',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  tableHeaderCell: {
    color: '#D1D5DB',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'left',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    minWidth: 850,
  },
  tableRowEven: {
    backgroundColor: '#F9FAFB',
  },
  tableRowOdd: {
    backgroundColor: '#FFFFFF',
  },
  tableCell: {
    color: '#1F2937',
    fontSize: 12,
    textAlign: 'left',
    paddingVertical: 8,
    paddingHorizontal: 16,
    lineHeight: 20,
  },
  cellId: {
    width: 80,
  },
  cellDate: {
    width: 180,
  },
  cellUser: {
    width: 140,
  },
  cellProducts: {
    width: 250,
  },
  cellAmount: {
    width: 140,
  },
  cellStatus: {
    width: 100,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
  },
  modalContainer: {
    width: 280,
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 2, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  closeButton: {
    alignSelf: 'flex-end',
    marginBottom: 16,
    backgroundColor: '#2563EB',
    borderRadius: 12,
    padding: 8,
  },
  menuItem: {
    backgroundColor: '#2563EB',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  logoutButton: {
    backgroundColor: '#DC2626',
  },
  menuText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    lineHeight: 24,
  },
});