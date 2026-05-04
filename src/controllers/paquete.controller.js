import { prisma } from '../config/prisma.js';

export const listarPaquetes = async (req, res) => {
  try {
    const paquetes = await prisma.paqueteCredito.findMany({
      where: { activo: true },
      orderBy: { cantidadCreditos: 'asc' }
    });
    res.json(paquetes);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const listarTodosPaquetes = async (req, res) => {
  try {
    const paquetes = await prisma.paqueteCredito.findMany({ orderBy: { createdAt: 'desc' } });
    res.json(paquetes);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const crearPaquete = async (req, res) => {
  try {
    const { titulo, descripcion, cantidadCreditos, precio, duracionDias, esClaseIndividual } = req.body;
    const paquete = await prisma.paqueteCredito.create({
      data: {
        titulo,
        descripcion,
        cantidadCreditos: parseInt(cantidadCreditos),
        precio: parseFloat(precio),
        duracionDias: duracionDias ? parseInt(duracionDias) : undefined,
        esClaseIndividual: esClaseIndividual ?? undefined
      }
    });
    res.status(201).json(paquete);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const actualizarPaquete = async (req, res) => {
  try {
    const { id } = req.params;
    const { titulo, descripcion, cantidadCreditos, precio, activo } = req.body;
    const paquete = await prisma.paqueteCredito.update({
      where: { id: parseInt(id) },
      data: { titulo, descripcion, cantidadCreditos: cantidadCreditos ? parseInt(cantidadCreditos) : undefined, precio: precio ? parseFloat(precio) : undefined, activo }
    });
    res.json(paquete);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};

export const eliminarPaquete = async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.paqueteCredito.update({
      where: { id: parseInt(id) },
      data: { activo: false }
    });
    res.json({ message: 'Paquete desactivado' });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
};
