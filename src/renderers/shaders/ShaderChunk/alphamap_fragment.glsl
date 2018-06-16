#ifdef USE_ALPHAMAP

	diffuseColor.a *= texture2D( alphaMap, alphaMapLookup ).g;

#endif
