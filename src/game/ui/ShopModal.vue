<template>
  <div class="shop-modal-overlay" v-if="visible" @click="handleClose">
    <div class="shop-modal-content" @click.stop>
      <div class="modal-header">
        <h2>战术补给站 · 第{{ level }}层</h2>
        <div class="shop-info">
          <span>当前金币</span>
          <span class="gold-amount">{{ currentGold }}</span>
        </div>
        <div class="shop-actions">
          <button 
            class="btn btn-refresh-all"
            :disabled="currentGold < refreshCost"
            @click="refreshAll"
            title="刷新未锁定的所有道具（包括空槽位）"
            aria-label="刷新所有"
          >
            <span class="btn-icon">🔄</span>
            <span class="btn-text">刷新商店</span>
            <span class="btn-cost">{{ refreshCost }} 金币</span>
          </button>
        </div>
      </div>
      <div class="shop-items">
        <div 
          v-for="(item, index) in shopItems" 
          :key="`slot-${index}`"
          class="shop-item"
          :class="[
            item ? `quality-${item.option?.color}` : 'empty-slot',
            item?.locked ? 'locked' : 'unlocked'
          ]"
        >
          <!-- 空槽位 -->
          <div v-if="!item || !item.option" class="empty-slot-content">
            <div class="empty-icon">📦</div>
            <div class="empty-text">空槽位</div>
            <div class="empty-hint">购买道具后此位置将显示为空</div>
          </div>
          
          <!-- 有道具的槽位 -->
          <template v-else>
            <div class="item-header">
              <div class="quality-indicator">
                <span class="quality-dot"></span>
                <span class="quality-text">{{ getQualityName(item.option.color) }}</span>
              </div>
              <h3 class="item-name">{{ item.option.name }}</h3>
            </div>
            <p class="item-description">{{ item.option.description }}</p>
            <p class="item-debuff" v-if="item.option.debuff">
              {{ item.option.debuff.description }}
            </p>
            <div class="item-footer">
              <div class="price-and-lock">
                <span class="item-price">{{ calculatePrice(item.option.color, level) }} 金币</span>
              <button
                class="btn btn-lock"
                @click.stop="toggleLock(index)"
                :aria-label="item.locked ? '解锁' : '锁定'"
                :title="item.locked ? '解锁该道具（可被刷新）' : '锁定该道具（不会被刷新）'"
                :class="{ 'locked': item.locked }"
              >
                  <span class="btn-icon">{{ item.locked ? '🔓' : '🔒' }}</span>
                  <span class="btn-text">{{ item.locked ? '解锁' : '锁定' }}</span>
                </button>
              </div>
              <button 
                class="btn btn-buy" 
                :disabled="currentGold < calculatePrice(item.option.color, level)"
                @click.stop="buyItem(item, index)"
              >
                <span class="btn-icon">💰</span>
                <span class="btn-text">购买</span>
              </button>
            </div>
          </template>
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary btn-close" @click="handleClose">
          <span class="btn-icon">✕</span>
          <span class="btn-text">离开商店</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { calculateShopPrice, type GeneratedReward } from '../../utils/RewardGenerator'

type ShopItem = (GeneratedReward & { locked?: boolean }) | null

interface Props {
  visible: boolean
  level: number
  currentGold: number
  shopItems: ShopItem[]
  refreshCost: number
}

interface Emits {
  (e: 'close'): void
  (e: 'buy-item', item: GeneratedReward & { locked?: boolean }, index: number): void
  (e: 'toggle-lock', index: number): void
  (e: 'refresh-all'): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const calculatePrice = (quality: 'green' | 'blue' | 'purple' | 'gold', layer: number) => {
  return calculateShopPrice(quality, layer)
}

const handleClose = () => {
  emit('close')
}

const buyItem = (item: ShopItem, index: number) => {
  console.log('ShopModal buyItem 被调用', { item, index })
  if (!item || !item.option) {
    console.warn('购买失败：道具或选项为空')
    return
  }
  emit('buy-item', item, index)
}

const toggleLock = (slotIndex: number) => {
  console.log('ShopModal toggleLock 被调用', slotIndex)
  emit('toggle-lock', slotIndex)
}

const refreshAll = () => {
  emit('refresh-all')
}

const getQualityName = (quality: 'green' | 'blue' | 'purple' | 'gold') => {
  switch (quality) {
    case 'green': return '绿色 · 基础'
    case 'blue': return '蓝色 · 战术'
    case 'purple': return '紫色 · 高阶'
    case 'gold': return '金色 · 传奇'
  }
}
</script>

<style scoped>
.shop-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(4px);
}

.shop-modal-content {
  position: relative;
  background: var(--secondary-bg);
  border: 2px solid var(--accent-color);
  border-radius: 16px;
  padding: 2rem;
  max-width: 1400px;
  width: 95%;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 20px 60px rgba(0, 255, 136, 0.3);
}

.modal-header {
  text-align: center;
  margin-bottom: 2rem;
  position: relative;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--border-color);
}

.modal-header h2 {
  color: var(--accent-color);
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  text-shadow: 0 0 20px rgba(0, 255, 136, 0.5);
}

.shop-info {
  color: var(--text-secondary);
  font-size: 1.2rem;
  display: flex;
  gap: 0.5rem;
  justify-content: center;
  align-items: baseline;
}

.gold-amount {
  color: #ffd700;
  font-weight: 600;
  font-size: 1.3rem;
  text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
}

.shop-actions {
  position: absolute;
  top: 0;
  right: 0;
}

.btn.btn-refresh-all {
  background: var(--warning-color);
  color: var(--primary-bg);
  border: 2px solid var(--warning-color);
  padding: 0.6rem 1rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  font-size: 0.9rem;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  transition: all 0.3s ease;
  white-space: nowrap;
}

.btn.btn-refresh-all:hover:not(:disabled) {
  background: #ff8800;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(255, 170, 0, 0.4);
}

.btn.btn-refresh-all:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn-icon {
  font-size: 1em;
  line-height: 1;
}

.btn-text {
  font-weight: bold;
}

.btn-cost {
  font-size: 0.85em;
  opacity: 0.9;
  margin-left: 0.3rem;
}

.shop-items {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1.2rem;
  margin-bottom: 2rem;
}

/* 所有层都是4个道具 */

.shop-item {
  background: var(--primary-bg);
  border: 2px solid var(--border-color);
  border-radius: 12px;
  padding: 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
  min-height: 180px;
  max-height: 400px;
}

.shop-item::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(135deg, rgba(0, 255, 136, 0.1), transparent);
  opacity: 0;
  transition: opacity 0.3s ease;
  pointer-events: none;
}

.shop-item:hover::before {
  opacity: 1;
}

.shop-item:hover {
  border-color: var(--accent-color);
  transform: translateY(-5px);
  box-shadow: 0 10px 30px rgba(0, 255, 136, 0.2);
}

/* 品质边框颜色 */
.shop-item.quality-green {
  border-color: #4ade80;
}

.shop-item.quality-green:hover {
  border-color: #22c55e;
  box-shadow: 0 10px 30px rgba(34, 197, 94, 0.3);
}

.shop-item.quality-blue {
  border-color: #60a5fa;
}

.shop-item.quality-blue:hover {
  border-color: #3b82f6;
  box-shadow: 0 10px 30px rgba(59, 130, 246, 0.3);
}

.shop-item.quality-purple {
  border-color: #a78bfa;
}

.shop-item.quality-purple:hover {
  border-color: #8b5cf6;
  box-shadow: 0 10px 30px rgba(139, 92, 246, 0.3);
}

.shop-item.quality-gold {
  border-color: #fbbf24;
  background: linear-gradient(135deg, rgba(251, 191, 36, 0.15), rgba(245, 158, 11, 0.1));
}

.shop-item.quality-gold:hover {
  border-color: #f59e0b;
  box-shadow: 0 10px 40px rgba(245, 158, 11, 0.5);
}

/* 空槽位样式 */
.shop-item.empty-slot {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.02);
  border-style: dashed;
  cursor: default;
}

.shop-item.empty-slot:hover {
  border-color: rgba(255, 255, 255, 0.15);
  transform: none;
  box-shadow: none;
}

.shop-item.empty-slot::before {
  display: none;
}

.empty-slot-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  flex: 1;
  color: var(--text-secondary);
}

.empty-icon {
  font-size: 3rem;
  opacity: 0.3;
}

.empty-text {
  font-size: 1rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.empty-hint {
  font-size: 0.75rem;
  opacity: 0.6;
  text-align: center;
}

.item-header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.item-name {
  color: #ffffff;
  font-size: 1.3rem;
  margin: 0;
  font-weight: bold;
  text-align: right;
  line-height: 1.4;
}

.item-description {
  color: var(--text-secondary);
  font-size: 0.85rem;
  line-height: 1.4;
  margin: 0;
  overflow-y: auto;
  max-height: 80px;
  flex-grow: 1;
}

.item-debuff {
  color: var(--danger-color);
  font-size: 0.85rem;
  margin: 0;
  line-height: 1.4;
  background: rgba(255, 68, 68, 0.15);
  border: 1px solid rgba(255, 68, 68, 0.5);
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
}

.item-footer {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-top: auto;
  gap: 0.5rem;
  padding-top: 0.5rem;
}

.price-and-lock {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  flex: 1;
}

.item-price {
  color: #ffd700;
  font-weight: 600;
  font-size: 0.9rem;
  text-shadow: 0 0 8px rgba(255, 215, 0, 0.5);
}

.btn {
  padding: 0;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.3s ease;
  font-family: inherit;
  position: relative;
  z-index: 1;
}

.btn-buy {
  background: var(--accent-color);
  color: var(--primary-bg);
  padding: 0.6rem 1.2rem;
  font-weight: bold;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  white-space: nowrap;
}

.btn-buy:hover:not(:disabled) {
  background: #00cc66;
  transform: translateY(-2px);
}

.btn-buy:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
}

.btn-lock {
  background: var(--border-color);
  color: var(--text-primary);
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.6rem;
  border: 1px solid var(--border-color);
  font-size: 0.8rem;
  white-space: nowrap;
  font-weight: 500;
}

.btn-lock:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--accent-color);
  transform: translateY(-1px);
}

.btn-lock.locked {
  background: rgba(255, 170, 0, 0.2);
  border-color: var(--warning-color);
  color: var(--warning-color);
}

.btn-secondary {
  background: var(--border-color);
  color: var(--text-primary);
  border: 2px solid var(--border-color);
  padding: 0.8rem 2rem;
  font-size: 1rem;
  font-weight: bold;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--accent-color);
  transform: translateY(-2px);
}

.btn-close {
  background: var(--danger-color);
  border-color: var(--danger-color);
  color: white;
}

.btn-close:hover {
  background: #cc3333;
}

.modal-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 2rem;
  border-top: 1px solid var(--border-color);
}

.quality-indicator {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.quality-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: currentColor;
  box-shadow: 0 0 8px currentColor;
  flex-shrink: 0;
}

.quality-green .quality-dot { color: #4ade80; }
.quality-blue .quality-dot { color: #60a5fa; }
.quality-purple .quality-dot { color: #a78bfa; }
.quality-gold .quality-dot { color: #fbbf24; }

.shop-item.locked {
  outline: 2px dashed var(--warning-color);
  outline-offset: -2px;
}

.shop-item.locked::after {
  content: '';
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 24px;
  height: 24px;
  background: var(--warning-color);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  pointer-events: none;
}
</style>
