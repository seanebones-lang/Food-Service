import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { prisma } from '../index';
import { squareService } from '../services/squareService';
import { aiService } from '../services/aiService';
import { twilioService } from '../services/twilioService';

const router = Router();

// Get all inventory items
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
  const { category, lowStock, limit = 50, offset = 0 } = req.query;

  const where: any = { isActive: true };
  if (category) where.category = category;
  if (lowStock === 'true') {
    where.currentStock = { lte: prisma.inventoryItem.fields.minStock };
  }

  const inventoryItems = await prisma.inventoryItem.findMany({
    where,
    orderBy: { name: 'asc' },
    take: parseInt(limit as string),
    skip: parseInt(offset as string)
  });

  res.json({
    success: true,
    data: inventoryItems
  });
}));

// Get inventory item by ID
router.get('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const inventoryItem = await prisma.inventoryItem.findUnique({
    where: { id }
  });

  if (!inventoryItem) {
    return res.status(404).json({
      success: false,
      error: 'Inventory item not found'
    });
  }

  res.json({
    success: true,
    data: inventoryItem
  });
}));

// Create inventory item
router.post('/', authenticateToken, asyncHandler(async (req, res) => {
  const {
    name,
    category,
    currentStock,
    minStock,
    maxStock,
    unit,
    costPerUnit,
    squareId
  } = req.body;

  const inventoryItem = await prisma.inventoryItem.create({
    data: {
      name,
      category,
      currentStock: parseInt(currentStock),
      minStock: parseInt(minStock),
      maxStock: parseInt(maxStock),
      unit,
      costPerUnit: parseFloat(costPerUnit),
      squareId
    }
  });

  res.status(201).json({
    success: true,
    data: inventoryItem
  });
}));

// Update inventory item
router.put('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {
    name,
    category,
    currentStock,
    minStock,
    maxStock,
    unit,
    costPerUnit,
    isActive
  } = req.body;

  const inventoryItem = await prisma.inventoryItem.update({
    where: { id },
    data: {
      name,
      category,
      currentStock: currentStock ? parseInt(currentStock) : undefined,
      minStock: minStock ? parseInt(minStock) : undefined,
      maxStock: maxStock ? parseInt(maxStock) : undefined,
      unit,
      costPerUnit: costPerUnit ? parseFloat(costPerUnit) : undefined,
      isActive
    }
  });

  res.json({
    success: true,
    data: inventoryItem
  });
}));

// Update stock level
router.patch('/:id/stock', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { quantity, operation = 'set' } = req.body; // operation: 'set', 'add', 'subtract'

  const inventoryItem = await prisma.inventoryItem.findUnique({
    where: { id }
  });

  if (!inventoryItem) {
    return res.status(404).json({
      success: false,
      error: 'Inventory item not found'
    });
  }

  let newStock = inventoryItem.currentStock;
  
  switch (operation) {
    case 'add':
      newStock += parseInt(quantity);
      break;
    case 'subtract':
      newStock -= parseInt(quantity);
      break;
    case 'set':
    default:
      newStock = parseInt(quantity);
      break;
  }

  const updatedItem = await prisma.inventoryItem.update({
    where: { id },
    data: { currentStock: newStock }
  });

  // Check for low stock alert
  if (newStock <= inventoryItem.minStock) {
    const managerPhone = process.env.MANAGER_PHONE;
    if (managerPhone) {
      await twilioService.sendInventoryAlert({
        name: inventoryItem.name,
        currentStock: newStock,
        minStock: inventoryItem.minStock,
        unit: inventoryItem.unit
      }, managerPhone);
    }
  }

  res.json({
    success: true,
    data: updatedItem
  });
}));

// Get low stock alerts
router.get('/alerts/low-stock', authenticateToken, asyncHandler(async (req, res) => {
  const lowStockItems = await prisma.inventoryItem.findMany({
    where: {
      isActive: true,
      currentStock: {
        lte: prisma.inventoryItem.fields.minStock
      }
    },
    orderBy: { currentStock: 'asc' }
  });

  res.json({
    success: true,
    data: lowStockItems
  });
}));

// Get AI inventory predictions
router.get('/predictions', authenticateToken, asyncHandler(async (req, res) => {
  const inventoryItems = await prisma.inventoryItem.findMany({
    where: { isActive: true }
  });

  // Calculate daily usage for each item (simplified calculation)
  const inventoryData = inventoryItems.map(item => ({
    itemName: item.name,
    currentStock: item.currentStock,
    dailyUsage: Math.max(1, item.currentStock / 7), // Rough estimate
    leadTime: 3 // Default 3 days lead time
  }));

  const predictions = await aiService.predictInventoryNeeds(inventoryData);

  res.json({
    success: true,
    data: predictions
  });
}));

// Sync inventory with Square
router.post('/sync/square', authenticateToken, asyncHandler(async (req, res) => {
  try {
    const syncedCount = await squareService.syncInventory();
    
    res.json({
      success: true,
      message: `Successfully synced ${syncedCount} inventory items with Square`,
      syncedCount
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to sync inventory with Square',
      details: error.message
    });
  }
}));

// Get inventory analytics
router.get('/analytics', authenticateToken, asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - parseInt(days as string));

  // Get inventory usage data (this would need to be calculated from order history)
  const inventoryItems = await prisma.inventoryItem.findMany({
    where: { isActive: true },
    include: {
      // This would need relations to order items for actual usage tracking
    }
  });

  const analytics = {
    totalItems: inventoryItems.length,
    lowStockItems: inventoryItems.filter(item => item.currentStock <= item.minStock).length,
    outOfStockItems: inventoryItems.filter(item => item.currentStock === 0).length,
    totalValue: inventoryItems.reduce((sum, item) => 
      sum + (item.currentStock * Number(item.costPerUnit)), 0
    ),
    averageStockLevel: inventoryItems.reduce((sum, item) => sum + item.currentStock, 0) / inventoryItems.length
  };

  res.json({
    success: true,
    data: analytics
  });
}));
