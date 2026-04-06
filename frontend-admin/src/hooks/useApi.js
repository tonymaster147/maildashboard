import { useAuth } from '../context/AuthContext';
import * as adminApi from '../services/api';
import { salesApi } from '../services/api';

/**
 * Returns the correct API functions based on user role.
 * Admin users get admin endpoints, sales users get sales endpoints.
 */
export function useApi() {
  const { isSalesUser } = useAuth();

  if (isSalesUser) {
    return {
      getDashboardStats: salesApi.getDashboard,
      getAllUsers: salesApi.getUsers,
      getAllTutors: salesApi.getTutors,
      createTutor: salesApi.createTutor,
      updateTutor: salesApi.updateTutor,
      deleteTutor: salesApi.deleteTutor,
      getAllOrders: salesApi.getOrders,
      updateOrderStatus: salesApi.updateOrderStatus,
      assignTutors: salesApi.assignTutors,
      reopenChat: salesApi.reopenChat,
      getAllChats: salesApi.getChats,
      getFlaggedMessages: salesApi.getFlaggedMessages,
      getReports: salesApi.getReports,
      getSettings: salesApi.getSettings,
      updatePlan: salesApi.updatePlan,
      createCoupon: salesApi.createCoupon,
      deleteCoupon: salesApi.deleteCoupon,
      getBannedWords: salesApi.getBannedWords,
      addBannedWord: salesApi.addBannedWord,
      deleteBannedWord: salesApi.deleteBannedWord,
      getNotifications: salesApi.getNotifications,
      markNotificationRead: salesApi.markNotificationRead,
      getUnreadCount: adminApi.getUnreadCount,
      markAllRead: adminApi.markAllRead,
      getUnreadPerOrder: adminApi.getUnreadPerOrder,
    };
  }

  return {
    getDashboardStats: adminApi.getDashboardStats,
    getAllUsers: adminApi.getAllUsers,
    getAllTutors: adminApi.getAllTutors,
    createTutor: adminApi.createTutor,
    updateTutor: adminApi.updateTutor,
    deleteTutor: adminApi.deleteTutor,
    getAllOrders: adminApi.getAllOrders,
    updateOrderStatus: adminApi.updateOrderStatus,
    assignTutors: adminApi.assignTutors,
    reopenChat: adminApi.reopenChat,
    getAllChats: adminApi.getAllChats,
    getFlaggedMessages: adminApi.getFlaggedMessages,
    getReports: adminApi.getReports,
    getSettings: adminApi.getSettings,
    updatePlan: adminApi.updatePlan,
    createCoupon: adminApi.createCoupon,
    deleteCoupon: adminApi.deleteCoupon,
    getBannedWords: adminApi.getBannedWords,
    addBannedWord: adminApi.addBannedWord,
    deleteBannedWord: adminApi.deleteBannedWord,
    getNotifications: adminApi.getNotifications,
    markNotificationRead: adminApi.markNotificationRead,
    getUnreadCount: adminApi.getUnreadCount,
    markAllRead: adminApi.markAllRead,
    getUnreadPerOrder: adminApi.getUnreadPerOrder,
  };
}
