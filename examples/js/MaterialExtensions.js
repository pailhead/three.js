const RENDER_ORDER_COLOR = 1;
const RENDER_ORDER_STENCIL = 2;
const RENDER_ORDER_CAP = 3;
const RENDER_ORDER_LINES = 4;

let _renderStage = 0;

const DEFAULT_PASS = 0;
const COLOR_PASS = 1;
const STENCIL_PASS = 2;
const CAP_PASS = 3;

const PLANE_GEOMETRY = new THREE.PlaneBufferGeometry( 2, 2, 1, 1 );
PLANE_GEOMETRY.rotateY( - Math.PI / 2 );

const STENCIL_MATERIAL = new THREE.MeshBasicMaterial( { side: THREE.BackSide } );
const STENCIL_MATERIAL_SKINNED = new THREE.MeshBasicMaterial( { side: THREE.BackSide, skinning: true } );

const CAP_MATERIAL_INCLUDES = {
	'dithering_fragment': `
		${THREE.ShaderChunk.dithering_fragment}
		float _f = 0.2;
		gl_FragColor.xyz *= 1.-_f + step(0.5,fract(vUv.x*1000.))*_f;
		gl_FragColor.xyz *= vec3(0.1,1.,0.1);
	`,
	'uv_vertex': `
		vUv = uv;
	`,
	'uv_pars_vertex': `
		varying vec2 vUv;
	`,
	'uv_pars_fragment': `
		varying vec2 vUv;
	`,
};

const COLOR_MATERIAL_INCLUDES = {

	'dithering_fragment': `
		${THREE.ShaderChunk.dithering_fragment}
		#if NUM_CLIPPING_PLANES > 0
		plane = clippingPlanes[ 0 ];
		float _dd = (dot( vViewPosition, plane.xyz )-plane.w)/(dot(plane.xyz,plane.xyz))*1500.;
		_dd = clamp(-_dd,0.,1.);
		gl_FragColor.xyz = mix( vec3(0.,1.,0.),gl_FragColor.xyz, vec3(_dd*0.8+0.2));
		#endif
	`
}

const onBeforeRenderColor = ( renderer )=>{

	if ( _renderStage === DEFAULT_PASS ) {

		_renderStage = COLOR_PASS;
		const gl = renderer.getContext();
		gl.enable( gl.STENCIL_TEST );
		gl.clearStencil( 0 );
		gl.stencilFunc( gl.ALWAYS, 0, 0xff );
		gl.stencilOp( gl.KEEP, gl.KEEP, gl.KEEP );

	}

};

const onBeforeRenderStencil = ( renderer )=>{


	if ( _renderStage === COLOR_PASS ) {

		_renderStage = STENCIL_PASS;

		const gl = renderer.getContext();
		gl.colorMask( false, false, false, false );
		gl.stencilFunc( gl.ALWAYS, 1, 0xff );
		gl.stencilOp( gl.KEEP, gl.KEEP, gl.REPLACE );

	}

};

const onBeforeRenderCap = ( renderer )=>{

	// console.log( 'baz' );

	if ( _renderStage === STENCIL_PASS ) {

		_renderStage = CAP_PASS;

		const gl = renderer.getContext();
		gl.colorMask( true, true, true, true );
		gl.stencilFunc( gl.EQUAL, 1, 0xff );
		gl.stencilOp( gl.KEEP, gl.KEEP, gl.KEEP );

	}

};

const onAfterRenderCap = renderer =>{

	if ( _renderStage === CAP_PASS ) {

		_renderStage = DEFAULT_PASS;

		const gl = renderer.getContext();
		gl.disable( gl.STENCIL_TEST );

	}

};

function CrossSectionObject( object ) {

	THREE.Object3D.call( this );

	this.type = 'CrossSectionObject';

	this._cap = new THREE.Mesh( PLANE_GEOMETRY, new THREE.MeshStandardMaterial({
		roughness:0.5,
		metalness: 0
	}) );
	this._cap.material.shaderIncludes = CAP_MATERIAL_INCLUDES;

	this._cap.renderOrder = RENDER_ORDER_CAP;

	this._cap.onBeforeRender = onBeforeRenderCap;
	this._cap.onAfterRender = onAfterRenderCap;

	this.add( this._cap );

	if ( object.parent ) {

		object.parent.add( this );

	}
	this.add( object );

	this._clipPlane = new THREE.Plane();

	this._materialClipPlane = [ this._clipPlane ];

	this.init( object );

}

CrossSectionObject.prototype = Object.assign( Object.create( THREE.Object3D.prototype ), {

	init: function ( object ) {

		const meshes = [];

		object.traverse( _obj=>{

			const stencilMaterial = STENCIL_MATERIAL.clone();
			const stencilMaterialSkinned = STENCIL_MATERIAL_SKINNED.clone();

			stencilMaterial.clippingPlanes = this._materialClipPlane;
			console.log( _obj );
			if ( _obj instanceof THREE.Mesh ) {

				console.log( _obj );
				// const renderStencil = new THREE.Mesh( _obj.geometry, stencilMaterial );

				const renderStencil = _obj.clone();
				renderStencil.material = _obj instanceof THREE.SkinnedMesh ? stencilMaterialSkinned : stencilMaterial;
				if ( ! _obj.userData ) {

					_obj.userData = {};

				}
				_obj.userData.renderStencil = renderStencil;

				meshes.push( _obj );

				renderStencil.renderOrder = RENDER_ORDER_STENCIL;
				_obj.renderOrder = RENDER_ORDER_COLOR;

				_obj.onBeforeRender = onBeforeRenderColor;
				renderStencil.onBeforeRender = onBeforeRenderStencil;

				_obj.material.clippingPlanes = this._materialClipPlane;
				_obj.material.shaderIncludes = COLOR_MATERIAL_INCLUDES

			} else if ( _obj instanceof THREE.LineSegments ) {

				_obj.material.clippingPlanes = this._materialClipPlane;
				_obj.renderOrder = RENDER_ORDER_LINES;

			}

		} );
		console.log( 'found', meshes );
		meshes.forEach( mesh=>mesh.add( mesh.userData.renderStencil ) );

	},

	setPlane: ( plane )=>{

		this._clipPlane.copy( plane );

		this.worldToLocal( this._cap.position.copy( plane.normal ).multiplyScalar( plane.constant ) );

	},

	setCrossSectionEnabled: val=>{

		this._materialClipPlane[ 0 ] = val ? this._clipPlane : null;

	}

} );
