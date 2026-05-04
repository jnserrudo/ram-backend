import { prisma } from '../config/prisma.js';

export const listarClases = async (req, res) => {
  try {
    const clases = await prisma.tipoClase.findMany({
      where: { activo: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(clases);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const crearClase = async (req, res) => {
  try {
    const { titulo, descripcion } = req.body;
    const clase = await prisma.tipoClase.create({
      data: { titulo, descripcion }
    });
    res.status(201).json(clase);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const actualizarClase = async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, descripcion, activo } = req.body;
    const clase = await prisma.tipoClase.update({
      where: { id: parseInt(id) },
      data: { titulo, descripcion, activo }
    });
    res.json(clase);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const eliminarClase = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.tipoClase.update({
      where: { id: parseInt(id) },
      data: { activo: false }
    });
    res.json({ message: 'Clase desactivada' });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};
