import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const p = new Array(512);
const permutation = [
    151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140,
    36, 103, 30, 69, 142, 8, 99, 37, 240, 21, 10, 23, 190, 6, 148, 247, 120, 234,
    75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88, 237,
    149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48,
    27, 166, 77, 146, 158, 231, 83, 111, 229, 122, 60, 211, 133, 230, 220, 105,
    92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216, 80, 73,
    209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86,
    164, 100, 109, 198, 173, 186, 3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38,
    147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58, 17, 182, 189,
    28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101,
    155, 167, 43, 172, 9, 129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232,
    178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193, 238, 210, 144, 12,
    191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31,
    181, 199, 106, 157, 184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254,
    138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128, 195, 78, 66, 215,
    61, 156, 180,
];

const shuffledPermutation = shuffleArray(permutation);
for (let i = 0; i < 256; i++) {
    p[256 + i] = p[i] = shuffledPermutation[i];
}

const fade = (t) => {
    return t * t * t * (t * (t * 6 - 15) + 10);
};

const lerp = (t, a, b) => {
    return a + t * (b - a);
};

const grad = (hash, x, y, z) => {
    const h = hash & 15;
    const u = h < 8 ? x : y,
        v = h < 4 ? y : h == 12 || h == 14 ? x : z;
    return ((h & 1) == 0 ? u : -u) + ((h & 2) == 0 ? v : -v);
};

class ImprovedNoise {
    static noise(x, y, z) {
        const X = Math.floor(x) & 255,
            Y = Math.floor(y) & 255,
            Z = Math.floor(z) & 255;
        x -= Math.floor(x);
        y -= Math.floor(y);
        z -= Math.floor(z);
        const u = fade(x),
            v = fade(y),
            w = fade(z);
        const A = p[X] + Y,
            AA = p[A] + Z,
            AB = p[A + 1] + Z,
            B = p[X + 1] + Y,
            BA = p[B] + Z,
            BB = p[B + 1] + Z;

        return lerp(
            w,
            lerp(
                v,
                lerp(u, grad(p[AA], x, y, z), grad(p[BA], x - 1, y, z)),
                lerp(u, grad(p[AB], x, y - 1, z), grad(p[BB], x - 1, y - 1, z))
            ),
            lerp(
                v,
                lerp(u, grad(p[AA + 1], x, y, z - 1), grad(p[BA + 1], x - 1, y, z - 1)),
                lerp(
                    u,
                    grad(p[AB + 1], x, y - 1, z - 1),
                    grad(p[BB + 1], x - 1, y - 1, z - 1)
                )
            )
        );
    }
}

class VoxelWorld {

    constructor( cellSize ) {
        this.cellSize = cellSize;
        this.cellSliceSize = cellSize * cellSize;
        this.cell = new Uint8Array( cellSize * cellSize * cellSize );
    }

    computeVoxelOffset( x, y, z ) {
        const { cellSize, cellSliceSize } = this;
        const voxelX = THREE.MathUtils.euclideanModulo( x, cellSize ) | 0;
        const voxelY = THREE.MathUtils.euclideanModulo( y, cellSize ) | 0;
        const voxelZ = THREE.MathUtils.euclideanModulo( z, cellSize ) | 0;
        return voxelY * cellSliceSize +
            voxelZ * cellSize +
            voxelX;
    }

    getCellForVoxel( x, y, z ) {
        const { cellSize } = this;
        const cellX = Math.floor( x / cellSize );
        const cellY = Math.floor( y / cellSize );
        const cellZ = Math.floor( z / cellSize );
        if ( cellX !== 0 || cellY !== 0 || cellZ !== 0 ) {
            return null;
        }
        return this.cell;
    }

    setVoxel( x, y, z, v ) {
        const cell = this.getCellForVoxel( x, y, z );
        if ( ! cell ) {
            return; // TODO: add a new cell?
        }
        const voxelOffset = this.computeVoxelOffset( x, y, z );
        cell[ voxelOffset ] = v;
    }

    getVoxel( x, y, z ) {
        const cell = this.getCellForVoxel( x, y, z );
        if ( ! cell ) {
            return 0;
        }
        const voxelOffset = this.computeVoxelOffset( x, y, z );
        return cell[ voxelOffset ];
    }

    generateGeometryDataForCell( cellX, cellY, cellZ ) {
        const { cellSize } = this;
        const positions = [];
        const normals = [];
        const indices = [];
        const startX = cellX * cellSize;
        const startY = cellY * cellSize;
        const startZ = cellZ * cellSize;

        for ( let y = 0; y < cellSize; ++ y ) {
            const voxelY = startY + y;
            for ( let z = 0; z < cellSize; ++ z ) {
                const voxelZ = startZ + z;
                for ( let x = 0; x < cellSize; ++ x ) {
                    const voxelX = startX + x;
                    const voxel = this.getVoxel( voxelX, voxelY, voxelZ );
                    if ( voxel ) {
                        // There is a voxel here but do we need faces for it?
                        for ( const { dir, corners } of VoxelWorld.faces ) {
                            const neighbor = this.getVoxel(
                                voxelX + dir[ 0 ],
                                voxelY + dir[ 1 ],
                                voxelZ + dir[ 2 ] );

                            if ( ! neighbor ) {
                                // this voxel has no neighbor in this direction so we need a face.
                                const ndx = positions.length / 3;
                                for ( const pos of corners ) {
                                    positions.push( pos[ 0 ] + x, pos[ 1 ] + y, pos[ 2 ] + z );
                                    normals.push( ...dir );
                                }

                                indices.push(
                                    ndx, ndx + 1, ndx + 2,
                                    ndx + 2, ndx + 1, ndx + 3,
                                );
                            }
                        }
                    }
                }
            }
        }
        return {
            positions,
            normals,
            indices,
        };
    }
}

VoxelWorld.faces = [
    { // left
        dir: [ - 1, 0, 0, ],
        corners: [
            [ 0, 1, 0 ],
            [ 0, 0, 0 ],
            [ 0, 1, 1 ],
            [ 0, 0, 1 ],
        ],
    },
    { // right
        dir: [ 1, 0, 0, ],
        corners: [
            [ 1, 1, 1 ],
            [ 1, 0, 1 ],
            [ 1, 1, 0 ],
            [ 1, 0, 0 ],
        ],
    },
    { // bottom
        dir: [ 0, - 1, 0, ],
        corners: [
            [ 1, 0, 1 ],
            [ 0, 0, 1 ],
            [ 1, 0, 0 ],
            [ 0, 0, 0 ],
        ],
    },
    { // top
        dir: [ 0, 1, 0, ],
        corners: [
            [ 0, 1, 1 ],
            [ 1, 1, 1 ],
            [ 0, 1, 0 ],
            [ 1, 1, 0 ],
        ],
    },
    { // back
        dir: [ 0, 0, - 1, ],
        corners: [
            [ 1, 0, 0 ],
            [ 0, 0, 0 ],
            [ 1, 1, 0 ],
            [ 0, 1, 0 ],
        ],
    },
    { // front
        dir: [ 0, 0, 1, ],
        corners: [
            [ 0, 0, 1 ],
            [ 1, 0, 1 ],
            [ 0, 1, 1 ],
            [ 1, 1, 1 ],
        ],
    },
];

function main() {
    const canvas = document.querySelector( '#c' );
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const renderer = new THREE.WebGLRenderer( { antialias: true, canvas } );

    const cellSize = 250;

    const fov = 75;
    const aspect = 2; // the canvas default
    const near = 0.1;
    const far = 1000;
    const camera = new THREE.PerspectiveCamera( fov, aspect, near, far );
    camera.position.set( - cellSize * .3, cellSize * .8, - cellSize * .3 );

    const controls = new OrbitControls( camera, canvas );
    controls.target.set( cellSize / 2, cellSize / 3, cellSize / 2 );
    controls.update();

    const scene = new THREE.Scene();
    //scene.background = new THREE.Color( 'lightblue' );

    scene.background = new THREE.TextureLoader().load("https://images.pexels.com/photos/1205301/pexels-photo-1205301.jpeg");

    /*const loader = new THREE.TextureLoader();
        loader.load('https://images.pexels.com/photos/1205301/pexels-photo-1205301.jpeg' , function(texture)
            {
            scene.background = texture;  
            });
    */

    function addLight( x, y, z ) {
        const color = 0xFFFFFF;
        const intensity = 3;
        const light = new THREE.DirectionalLight( color, intensity );
        light.position.set( x, y, z );
        scene.add( light );
    }
    addLight( - 1, 2, 4 );
    addLight( 1, - 1, - 2 );

    // creates the voxel world
    const world = new VoxelWorld( cellSize );

    for ( let y = cellSize*0.2; y < cellSize; ++ y ) {
        for ( let z = 0; z < cellSize; ++ z ) {
            for ( let x = 0; x < cellSize; ++ x ) {

                //const val = ImprovedNoise.noise(x/cellSize,y*10/cellSize,z*10/cellSize)
                const height = (ImprovedNoise.noise(x*5/cellSize,0.5,z*5/cellSize) * (cellSize*0.2)) + (cellSize*0.4)
                //const height = ( Math.sin( x / cellSize * Math.PI * 2 ) + Math.sin( z / cellSize * Math.PI * 3 ) ) * ( cellSize / 6 ) + ( cellSize / 2 );
                // if ( val > -0.25 ) {
                //     world.setVoxel( x, y, z, 1 );
                // }
                if (y < height) {
                    world.setVoxel( x, y, z, 1 );
                }
            }
        }
    }

    const { positions, normals, indices } = world.generateGeometryDataForCell( 0, 0, 0 );
    const geometry = new THREE.BufferGeometry();
    const material = new THREE.MeshLambertMaterial( { color: 'green' } );

    const positionNumComponents = 3;
    const normalNumComponents = 3;
    geometry.setAttribute(
        'position',
        new THREE.BufferAttribute( new Float32Array( positions ), positionNumComponents ) );
    geometry.setAttribute(
        'normal',
        new THREE.BufferAttribute( new Float32Array( normals ), normalNumComponents ) );
    geometry.setIndex( indices );
    const mesh = new THREE.Mesh( geometry, material );
    scene.add( mesh );

    function resizeRendererToDisplaySize( renderer ) {
        const canvas = renderer.domElement;
        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const needResize = canvas.width !== width || canvas.height !== height;
        if ( needResize ) {
            renderer.setSize( width, height, false );
        }
        return needResize;
    }

    let renderRequested = false;

    function render() {
        renderRequested = undefined;
        if ( resizeRendererToDisplaySize( renderer ) ) {
            const canvas = renderer.domElement;
            camera.aspect = canvas.clientWidth / canvas.clientHeight;
            camera.updateProjectionMatrix();
        }
        controls.update();
        renderer.render( scene, camera );
    }

    render();

    function requestRenderIfNotRequested() {
        if ( ! renderRequested ) {
            renderRequested = true;
            requestAnimationFrame( render );
        }
    }

    controls.addEventListener( 'change', requestRenderIfNotRequested );
    window.addEventListener( 'resize', requestRenderIfNotRequested );
}

/* Randomize array in-place using Durstenfeld shuffle algorithm */
function shuffleArray(array) {
    for (var i = array.length - 1; i >= 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = array[i];
        array[i] = array[j];
        array[j] = temp;
    }
    return array;
}

main();

