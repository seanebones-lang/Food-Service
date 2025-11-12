import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import Toast from 'react-native-toast-message';

interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  imageUrl?: string;
  isAvailable: boolean;
}

interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
}

export const POSScreen: React.FC = () => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [customerName, setCustomerName] = useState<string>('');
  const queryClient = useQueryClient();

  // Fetch menu items
  const { data: menuResponse, isLoading } = useQuery({
    queryKey: ['menuItems'],
    queryFn: async () => {
      const response = await api.getMenuItems();
      return response.data || [];
    },
  });

  const menuItems: MenuItem[] = menuResponse || [];

  // Create order mutation
  const createOrderMutation = useMutation({
    mutationFn: async (orderData: any) => {
      return await api.createOrder(orderData);
    },
    onSuccess: () => {
      setCart([]);
      setCustomerName('');
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      Toast.show({
        type: 'success',
        text1: 'Order Created',
        text2: 'Order has been successfully created',
      });
    },
    onError: (error: any) => {
      Toast.show({
        type: 'error',
        text1: 'Order Failed',
        text2: error.message || 'Failed to create order',
      });
    },
  });

  const addToCart = (item: MenuItem) => {
    const existingItem = cart.find((c) => c.menuItem.id === item.id);

    if (existingItem) {
      setCart(
        cart.map((c) =>
          c.menuItem.id === item.id
            ? { ...c, quantity: c.quantity + 1 }
            : c
        )
      );
    } else {
      setCart([...cart, { menuItem: item, quantity: 1 }]);
    }
  };

  const removeFromCart = (itemId: string) => {
    setCart(cart.filter((c) => c.menuItem.id !== itemId));
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(
      cart
        .map((c) =>
          c.menuItem.id === itemId
            ? { ...c, quantity: Math.max(0, c.quantity + delta) }
            : c
        )
        .filter((c) => c.quantity > 0)
    );
  };

  const getTotalPrice = () => {
    return cart.reduce((sum, item) => sum + item.menuItem.price * item.quantity, 0);
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      Alert.alert('Error', 'Cart is empty');
      return;
    }

    if (!customerName.trim()) {
      Alert.alert('Error', 'Please enter customer name');
      return;
    }

    const orderItems = cart.map((item) => ({
      menuItemId: item.menuItem.id,
      quantity: item.quantity,
      notes: item.notes,
    }));

    createOrderMutation.mutate({
      orderItems,
      customerName: customerName.trim(),
      channel: 'IN_PERSON',
      syncToSquare: true,
    });
  };

  const categories = ['all', ...Array.from(new Set(menuItems.map((i: MenuItem) => i.category)))];
  const filteredItems =
    selectedCategory === 'all'
      ? menuItems
      : menuItems.filter((i: MenuItem) => i.category === selectedCategory);

  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Category Filter */}
      <View style={styles.categoryContainer}>
        <FlatList
          horizontal
          data={categories}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.categoryButton,
                selectedCategory === item && styles.categoryButtonActive,
              ]}
              onPress={() => setSelectedCategory(item)}
            >
              <Text
                style={[
                  styles.categoryText,
                  selectedCategory === item && styles.categoryTextActive,
                ]}
              >
                {item.toUpperCase()}
              </Text>
            </TouchableOpacity>
          )}
          showsHorizontalScrollIndicator={false}
        />
      </View>

      {/* Menu Grid */}
      <View style={styles.menuContainer}>
        <FlatList
          data={filteredItems}
          keyExtractor={(item) => item.id}
          numColumns={3}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.menuItem,
                !item.isAvailable && styles.menuItemDisabled,
              ]}
              onPress={() => item.isAvailable && addToCart(item)}
              disabled={!item.isAvailable}
            >
              <Text style={styles.menuItemName}>{item.name}</Text>
              <Text style={styles.menuItemPrice}>${item.price.toFixed(2)}</Text>
              {!item.isAvailable && (
                <Text style={styles.outOfStock}>OUT OF STOCK</Text>
              )}
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Cart Section */}
      <View style={styles.cartContainer}>
        <Text style={styles.cartTitle}>Current Order</Text>

        <TextInput
          style={styles.input}
          placeholder="Customer Name"
          value={customerName}
          onChangeText={setCustomerName}
        />

        <FlatList
          data={cart}
          keyExtractor={(item) => item.menuItem.id}
          renderItem={({ item }) => (
            <View style={styles.cartItem}>
              <View style={styles.cartItemDetails}>
                <Text style={styles.cartItemName}>{item.menuItem.name}</Text>
                <Text style={styles.cartItemPrice}>
                  ${(item.menuItem.price * item.quantity).toFixed(2)}
                </Text>
              </View>
              <View style={styles.quantityControls}>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => updateQuantity(item.menuItem.id, -1)}
                >
                  <Text style={styles.quantityButtonText}>-</Text>
                </TouchableOpacity>
                <Text style={styles.quantity}>{item.quantity}</Text>
                <TouchableOpacity
                  style={styles.quantityButton}
                  onPress={() => updateQuantity(item.menuItem.id, 1)}
                >
                  <Text style={styles.quantityButtonText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />

        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total:</Text>
          <Text style={styles.totalAmount}>${getTotalPrice().toFixed(2)}</Text>
        </View>

        <TouchableOpacity
          style={[
            styles.checkoutButton,
            (cart.length === 0 || createOrderMutation.isPending) &&
              styles.checkoutButtonDisabled,
          ]}
          onPress={handleCheckout}
          disabled={cart.length === 0 || createOrderMutation.isPending}
        >
          {createOrderMutation.isPending ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.checkoutButtonText}>Process Order</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryContainer: {
    padding: 10,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  categoryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#F0F0F0',
  },
  categoryButtonActive: {
    backgroundColor: '#007AFF',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  categoryTextActive: {
    color: '#FFF',
  },
  menuContainer: {
    flex: 2,
    padding: 10,
  },
  menuItem: {
    flex: 1,
    margin: 5,
    padding: 15,
    backgroundColor: '#FFF',
    borderRadius: 8,
    alignItems: 'center',
    minHeight: 100,
    justifyContent: 'center',
  },
  menuItemDisabled: {
    opacity: 0.5,
  },
  menuItemName: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 5,
  },
  menuItemPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  outOfStock: {
    fontSize: 10,
    color: '#F44336',
    marginTop: 5,
  },
  cartContainer: {
    flex: 1,
    backgroundColor: '#FFF',
    padding: 15,
    borderLeftWidth: 1,
    borderLeftColor: '#E0E0E0',
  },
  cartTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 15,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  cartItemDetails: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 14,
    fontWeight: '600',
  },
  cartItemPrice: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  quantityControls: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  quantityButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  quantityButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  quantity: {
    marginHorizontal: 10,
    fontSize: 16,
    fontWeight: '600',
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
    paddingTop: 15,
    borderTopWidth: 2,
    borderTopColor: '#E0E0E0',
  },
  totalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  totalAmount: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  checkoutButton: {
    backgroundColor: '#4CAF50',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  checkoutButtonDisabled: {
    backgroundColor: '#CCC',
  },
  checkoutButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
