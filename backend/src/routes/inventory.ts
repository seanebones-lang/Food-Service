import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { prisma } from '../index';

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
    // TODO: Send SMS alert via Twilio
    console.log(`LOW STOCK ALERT: ${inventoryItem.name} is at ${newStock} ${inventoryItem.unit}`);
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

export default router;
