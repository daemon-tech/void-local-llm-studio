import { useMemo } from 'react'
import * as THREE from 'three'

export default function NeonGrid({ size = 50, divisions = 20 }) {
  const gridHelper = useMemo(() => {
    const grid = new THREE.GridHelper(size, divisions, '#00ffff', '#003333')
    grid.material.opacity = 0.3
    grid.material.transparent = true
    return grid
  }, [size, divisions])

  return (
    <primitive object={gridHelper} />
  )
}
