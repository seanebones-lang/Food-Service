import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@restaurant.com' },
    update: {},
    create: {
      email: 'admin@restaurant.com',
      password: adminPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: 'ADMIN'
    }
  });

  console.log('✅ Admin user created:', admin.email);

  // Create sample menu items
  const menuItems = [
    {
      name: 'Margherita Pizza',
      description: 'Fresh mozzarella, tomato sauce, basil',
      price: 16.99,
      category: 'Pizza',
      imageUrl: 'https://images.unsplash.com/photo-1604382354936-07c5d9983bd3?w=400',
      modifiers: JSON.stringify([
        { name: 'Size', options: ['Small (+$0)', 'Medium (+$3)', 'Large (+$6)'] },
        { name: 'Extra Toppings', options: ['Pepperoni (+$2)', 'Mushrooms (+$1.50)', 'Olives (+$1.50)'] }
      ])
    },
    {
      name: 'Caesar Salad',
      description: 'Romaine lettuce, parmesan, croutons, caesar dressing',
      price: 12.99,
      category: 'Salads',
      imageUrl: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?w=400',
      modifiers: JSON.stringify([
        { name: 'Protein', options: ['Grilled Chicken (+$4)', 'Salmon (+$6)', 'None (+$0)'] }
      ])
    },
    {
      name: 'Spaghetti Carbonara',
      description: 'Pasta with eggs, cheese, pancetta, black pepper',
      price: 18.99,
      category: 'Pasta',
      imageUrl: 'https://images.unsplash.com/photo-1621996346565-e3dbc353d2e5?w=400',
      modifiers: JSON.stringify([
        { name: 'Spice Level', options: ['Mild', 'Medium', 'Hot'] }
      ])
    },
    {
      name: 'Grilled Salmon',
      description: 'Atlantic salmon, lemon herb butter, seasonal vegetables',
      price: 24.99,
      category: 'Main Course',
      imageUrl: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400',
      modifiers: JSON.stringify([
        { name: 'Cooking', options: ['Medium Rare', 'Medium', 'Well Done'] }
      ])
    },
    {
      name: 'Chocolate Lava Cake',
      description: 'Warm chocolate cake with molten center, vanilla ice cream',
      price: 8.99,
      category: 'Desserts',
      imageUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=400',
      modifiers: JSON.stringify([
        { name: 'Ice Cream', options: ['Vanilla', 'Chocolate', 'Strawberry'] }
      ])
    },
    {
      name: 'Craft Beer',
      description: 'Local IPA, 16oz draft',
      price: 6.99,
      category: 'Beverages',
      imageUrl: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=400',
      modifiers: JSON.stringify([
        { name: 'Size', options: ['12oz (+$0)', '16oz (+$2)', 'Pitcher (+$8)'] }
      ])
    }
  ];

  for (const item of menuItems) {
    const existingItem = await prisma.menuItem.findFirst({
      where: { name: item.name }
    });
    
    if (!existingItem) {
      const menuItem = await prisma.menuItem.create({
        data: item
      });
      console.log('✅ Menu item created:', menuItem.name);
    } else {
      console.log('⏭️  Menu item already exists:', item.name);
    }
  }

  // Create sample inventory items
  const inventoryItems = [
    {
      name: 'Mozzarella Cheese',
      category: 'Dairy',
      currentStock: 50,
      minStock: 10,
      maxStock: 100,
      unit: 'lbs',
      costPerUnit: 4.50
    },
    {
      name: 'Tomato Sauce',
      category: 'Pantry',
      currentStock: 25,
      minStock: 5,
      maxStock: 50,
      unit: 'cans',
      costPerUnit: 2.25
    },
    {
      name: 'Fresh Basil',
      category: 'Produce',
      currentStock: 5,
      minStock: 2,
      maxStock: 20,
      unit: 'bunches',
      costPerUnit: 1.50
    },
    {
      name: 'Salmon Fillet',
      category: 'Seafood',
      currentStock: 15,
      minStock: 5,
      maxStock: 30,
      unit: 'lbs',
      costPerUnit: 12.00
    },
    {
      name: 'Romaine Lettuce',
      category: 'Produce',
      currentStock: 8,
      minStock: 3,
      maxStock: 15,
      unit: 'heads',
      costPerUnit: 2.00
    }
  ];

  for (const item of inventoryItems) {
    const existingItem = await prisma.inventoryItem.findFirst({
      where: { name: item.name }
    });
    
    if (!existingItem) {
      const inventoryItem = await prisma.inventoryItem.create({
        data: item
      });
      console.log('✅ Inventory item created:', inventoryItem.name);
    } else {
      console.log('⏭️  Inventory item already exists:', item.name);
    }
  }

  // Create sample loyalty customer
  const loyaltyCustomer = await prisma.loyaltyCustomer.upsert({
    where: { customerPhone: '+1234567890' },
    update: {},
    create: {
      customerName: 'John Doe',
      customerPhone: '+1234567890',
      customerEmail: 'john.doe@email.com',
      points: 150,
      tier: 'SILVER',
      totalSpent: 245.50
    }
  });

  console.log('✅ Loyalty customer created:', loyaltyCustomer.customerName);

  console.log('🎉 Database seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
