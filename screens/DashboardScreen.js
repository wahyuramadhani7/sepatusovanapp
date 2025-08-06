import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert, Modal, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';

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
        <Text style={[styles.tableCell, styles.cellStatus, { color: '#34D399' }]} numberOfLines={1} ellipsizeMode="tail">
          {item.status || '-'}
        </Text>
      </View>
    );
  };

  // Render header for FlatList
  const renderHeader = () => {
    return (
      <View>
        {/* Header with Hamburger Menu */}
        <View style={styles.headerContainer}>
          <View style={styles.heroSection}>
            <View style={styles.heroOverlay}>
              <Text style={styles.heroText}>By Sovan Store</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.hamburgerButton} onPress={() => setMenuVisible(true)}>
            <Ionicons name="menu" size={28} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          {/* Daily Report Section */}
          <Text style={styles.sectionTitle}>Laporan Harian</Text>
          <View style={styles.cardContainer}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Total Unit</Text>
              <View style={styles.cardContent}>
                <Text style={styles.cardValue}>{totalUnits}</Text>
              </View>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Transaksi Hari Ini</Text>
              <View style={styles.cardContent}>
                <Text style={styles.cardValue}>{totalTransactions}</Text>
              </View>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Penjualan Hari Ini</Text>
              <View style={styles.cardContent}>
                <Text style={styles.cardValue}>Rp {totalSales.toLocaleString('id-ID')}</Text>
              </View>
            </View>
          </View>

          {/* Data Section */}
          <View style={styles.dataContainer}>
            {/* Transaksi Harian */}
            <View style={styles.dataCard}>
              <Text style={styles.dataTitle}>Transaksi Harian</Text>
              <Text style={styles.dataSubtitle}>
                Laporan Transaksi Per Jam (hingga {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB)
              </Text>
              {filteredHourlyData.length === 0 ? (
                <Text style={styles.noDataText}>
                  Tidak ada transaksi hingga {new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB
                </Text>
              ) : (
                filteredHourlyData.map((data, index) => (
                  <Text key={index} style={styles.dataText}>
                    {filteredHourlyLabels[index]}: {data} transaksi
                  </Text>
                ))
              )}
            </View>

            {/* Produk Terlaris */}
            <View style={styles.dataCard}>
              <Text style={styles.dataTitle}>Produk Terlaris</Text>
              <Text style={styles.dataSubtitle}>
                Bulan Ini ({new Date().toLocaleString('id-ID', { month: 'long', year: 'numeric' })})
              </Text>
              {topProducts.length === 0 ? (
                <Text style={styles.noDataText}>Tidak ada data produk terlaris</Text>
              ) : (
                topProducts.slice(0, 5).map((product, index) => (
                  <Text key={index} style={styles.dataText}>
                    {product.name || '-'}: {product.quantity || 0} unit
                  </Text>
                ))
              )}
            </View>
          </View>

          {/* Transactions Table */}
          <View style={styles.tableContainer}>
            <Text style={styles.sectionTitle}>Detail Transaksi</Text>
            {recentTransactions.length === 0 ? (
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
                    data={recentTransactions}
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
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF4500" />
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
        animationType="fade"
        transparent={true}
        visible={menuVisible}
        onRequestClose={() => setMenuVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
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
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    color: '#1F2937',
    fontSize: 16,
    marginTop: 12,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#F9FAFB',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#FF4500',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 3,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerContainer: {
    backgroundColor: '#1F2937',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 5,
  },
  heroSection: {
    height: 160,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#FF4500',
  },
  heroOverlay: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF4500',
  },
  heroText: {
    color: '#FF4500',
    fontSize: 26,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  hamburgerButton: {
    position: 'absolute',
    top: 15,
    right: 15,
    padding: 12,
    backgroundColor: '#3B82F6',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  content: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginVertical: 24,
    color: '#1F2937',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cardContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
    gap: 16,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    width: '31%',
    minWidth: 120,
    maxWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
    marginBottom: 12,
  },
  cardTitle: {
    backgroundColor: '#1F2937',
    color: '#FFFFFF',
    padding: 12,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
  },
  cardContent: {
    padding: 16,
    alignItems: 'center',
  },
  cardValue: {
    color: '#1F2937',
    fontSize: 18,
    fontWeight: '700',
  },
  dataContainer: {
    marginBottom: 24,
  },
  dataCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
  },
  dataTitle: {
    color: '#1F2937',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  dataSubtitle: {
    color: '#6B7280',
    fontSize: 13,
    marginBottom: 12,
  },
  dataText: {
    color: '#1F2937',
    fontSize: 13,
    marginVertical: 6,
  },
  noDataText: {
    color: '#6B7280',
    textAlign: 'center',
    padding: 16,
    fontSize: 13,
    fontStyle: 'italic',
  },
  tableContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 3,
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
    paddingHorizontal: 12,
    borderBottomWidth: 2,
    borderBottomColor: '#FF4500',
  },
  tableHeaderCell: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'left',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
    minWidth: 850,
  },
  tableRowEven: {
    backgroundColor: '#F9FAFB',
  },
  tableRowOdd: {
    backgroundColor: '#F3F4F6',
  },
  tableCell: {
    color: '#1F2937',
    fontSize: 12,
    textAlign: 'left',
    paddingVertical: 8,
    paddingHorizontal: 12,
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '80%',
    maxWidth: 300,
    backgroundColor: '#FFFFFF',
    borderRadius: 15,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  closeButton: {
    alignSelf: 'flex-end',
    marginBottom: 12,
  },
  menuItem: {
    backgroundColor: '#3B82F6',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  logoutButton: {
    backgroundColor: '#FF4500',
  },
  menuText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});