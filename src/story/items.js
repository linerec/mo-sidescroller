/**
 * 아이템 정의. Collectible/Inventory/HUD 가 공유한다.
 *  shape    : Collectible 임시 외형 ('gem' | 'key' | 'orb')
 *  stackable: 개수 표시
 *  keyItem  : 퍼즐/진행용 (HUD에 항상 표시)
 *  consume  : ExitDoor 등에서 사용 시 소모
 */
export const ITEMS = {
  memory_fragment: { name: '기억 조각', icon: '◆', color: '#7ec8e3', shape: 'gem', stackable: true,
    desc: '누군가의 잊힌 기억. 모으면 무언가 떠오를지도.' },
  old_key: { name: '낡은 열쇠', icon: '🗝', color: '#e9c46a', shape: 'key', keyItem: true, consume: true,
    desc: '녹슬었지만 아직 무언가를 열 수 있다.' },
  lantern: { name: '등불', icon: '🏮', color: '#ffb347', shape: 'orb', keyItem: true, use: 'light',
    desc: '노인이 건네준 등불. 어둠을 조금 밀어낸다.' },
};
