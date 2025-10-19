import { Router } from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { authenticateToken } from '../middleware/auth';
import { prisma } from '../index';

const router = Router();

// Get all menu items
router.get('/', asyncHandler(async (req, res) => {
  const menuItems = await prisma.menuItem.findMany({
    where: { isAvailable: true },
    orderBy: { category: 'asc' }
  });

  res.json({
    success: true,
    data: menuItems
  });
}));

// Get menu item by ID
router.get('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  
  const menuItem = await prisma.menuItem.findUnique({
    where: { id }
  });

  if (!menuItem) {
    return res.status(404).json({
      success: false,
      error: 'Menu item not found'
    });
  }

  res.json({
    success: true,
    data: menuItem
  });
}));

// Create menu item (admin only)
router.post('/', authenticateToken, asyncHandler(async (req, res) => {
  const { name, description, price, category, imageUrl, modifiers } = req.body;

  const menuItem = await prisma.menuItem.create({
    data: {
      name,
      description,
      price: parseFloat(price),
      category,
      imageUrl,
      modifiers: modifiers ? JSON.parse(modifiers) : null
    }
  });

  res.status(201).json({
    success: true,
    data: menuItem
  });
}));

// Update menu item (admin only)
router.put('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, description, price, category, isAvailable, imageUrl, modifiers } = req.body;

  const menuItem = await prisma.menuItem.update({
    where: { id },
    data: {
      name,
      description,
      price: price ? parseFloat(price) : undefined,
      category,
      isAvailable,
      imageUrl,
      modifiers: modifiers ? JSON.parse(modifiers) : undefined
    }
  });

  res.json({
    success: true,
    data: menuItem
  });
}));

// Delete menu item (admin only)
router.delete('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const { id } = req.params;

  await prisma.menuItem.delete({
    where: { id }
  });

  res.json({
    success: true,
    message: 'Menu item deleted successfully'
  });
}));

export default router;
