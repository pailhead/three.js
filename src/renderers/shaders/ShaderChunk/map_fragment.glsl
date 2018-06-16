#ifdef USE_MAP

	vec4 texelColor = texture2D( map, mapLookup );

	texelColor = mapTexelToLinear( texelColor );
	diffuseColor *= texelColor;

#endif
