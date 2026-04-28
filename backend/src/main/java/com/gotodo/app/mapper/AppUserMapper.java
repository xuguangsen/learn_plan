package com.gotodo.app.mapper;

import com.gotodo.app.entity.AppUser;
import java.util.Optional;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * 用户表数据访问层。
 * 这个接口演示 MyBatis 的 XML Mapper 写法，具体 SQL 放在 resources/mapper/AppUserMapper.xml 中。
 */
@Mapper
public interface AppUserMapper {
  Optional<AppUser> findById(@Param("id") Long id);

  Optional<AppUser> findByUsername(@Param("username") String username);

  boolean existsByUsername(@Param("username") String username);

  int insert(AppUser user);
}
